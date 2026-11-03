import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getRequestContext } from "../lib/context";
import { validate } from "../lib/validate";
import { createBotSchema, setBotModelSchema } from "../lib/schemas/bot";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { userLimit } from "../middleware/rate-limit";
import { computerFor } from "../computer/sandbox-backend";
import { cleanupThreads } from "../lib/cleanup";
import { resolveModel } from "../agent/models";
import { bot, chatThread } from "../db/schema";

const bots = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const rows = await db
      .select({
        id: bot.id,
        name: bot.name,
        description: bot.description,
        shape: bot.shape,
        color: bot.color,
        expression: bot.expression,
        modelId: bot.modelId,
        reasoningEffort: bot.reasoningEffort,
      })
      .from(bot)
      .where(eq(bot.userId, c.get("session").user.id))
      .orderBy(desc(bot.createdAt));
    // No HTTP caching: the client keeps its own TTL cache and must never
    // re-serve a stale list over an optimistic create/update/delete.
    c.header("Cache-Control", "no-store");
    return c.json({ bots: rows });
  })

  .post("/", userLimit, validate("json", createBotSchema), async (c) => {
    const { db } = getRequestContext(c);
    const [created] = await db
      .insert(bot)
      .values({
        id: crypto.randomUUID(),
        userId: c.get("session").user.id,
        ...c.req.valid("json"),
      })
      .returning();
    return c.json({ bot: created }, 201);
  })

  .patch("/:id", userLimit, validate("json", createBotSchema), async (c) => {
    const { db } = getRequestContext(c);
    const [updated] = await db
      .update(bot)
      .set(c.req.valid("json"))
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, c.get("session").user.id)))
      .returning();
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    return c.json({ bot: updated });
  })

  // The model picked in the prompt bar, saved so it is still selected after a refresh or on another device.
  // Its own route: the avatar form (PATCH above) must never overwrite it, nor this the avatar.
  .put("/:id/model", userLimit, validate("json", setBotModelSchema), async (c) => {
    const { db } = getRequestContext(c);
    const { modelId, reasoningEffort } = c.req.valid("json");
    const model = resolveModel(modelId);
    if (!model) return c.json({ error: "INVALID_INPUT", message: "Unknown model" }, 400);
    if (reasoningEffort && !model.reasoningEfforts.includes(reasoningEffort)) {
      return c.json({ error: "INVALID_INPUT", message: "Unsupported reasoning effort" }, 400);
    }
    const [updated] = await db
      .update(bot)
      .set({ modelId, reasoningEffort: reasoningEffort ?? null })
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, c.get("session").user.id)))
      .returning({ id: bot.id });
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    return c.json({ ok: true });
  })

  /**
   * Deletes the bot and everything it owns: its running work is stopped, its chats go with it (the
   * database cascades threads, messages and events), its agent memory is removed, and its Linux account
   * and files are removed from the user's computer (now if it is awake, otherwise on its next wake).
   */
  .delete("/:id", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");

    const [owned] = await db
      .select({ id: bot.id })
      .from(bot)
      .where(and(eq(bot.id, id), eq(bot.userId, userId)))
      .limit(1);
    if (!owned) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);

    const threads = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.botId, id), eq(chatThread.userId, userId)));
    // Stop its runs first, so nothing writes to rows that are about to go.
    await cleanupThreads(db, env, threads.map((t) => t.id));
    await db.delete(bot).where(and(eq(bot.id, id), eq(bot.userId, userId)));
    // Its files on the computer. A failure here must not undo the deletion above: its runs are stopped
    // and its threads are gone (every run slice checks its thread still exists), so nothing uses it again.
    await computerFor(env, userId)
      .removeBot(id)
      .catch((e: unknown) => console.error("[bots] computer cleanup failed", e));
    return c.json({ ok: true });
  });

export default bots;
