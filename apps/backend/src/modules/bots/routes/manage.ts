import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { createBotSchema, setBotModelSchema } from "../schemas";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { computerFor } from "../../computer/sandbox-backend";
import { cleanupThreads } from "../../chat/cleanup";
import { modelError } from "../../agent/models";
import { domainFor } from "../../agent/domains";
import { bot, chatThread } from "../../../db/schema";
import { ownedBotId, setBotIntegrations } from "../queries";

const manage = new Hono<AuthGuardEnv>()
  .post("/", userLimit, validate("json", createBotSchema), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillIds, mcpServerIds, ...fields } = c.req.valid("json");
    // Capabilities the form did not send come from the role (e.g. research bots spawn sub-agents).
    const defaults = domainFor(fields.role).defaults;
    const [created] = await db
      .insert(bot)
      .values({
        id: crypto.randomUUID(),
        userId,
        ...fields,
        subagentsEnabled: fields.subagentsEnabled ?? defaults.subagents,
        maxSubagents: fields.maxSubagents ?? defaults.maxSubagents,
        maxParallelTools: fields.maxParallelTools ?? defaults.maxParallelTools,
      })
      .returning();
    await setBotIntegrations(db, userId, created!.id, skillIds, mcpServerIds);
    return c.json({ bot: { ...created, skillIds: skillIds ?? [], mcpServerIds: mcpServerIds ?? [] } }, 201);
  })

  .patch("/:id", userLimit, validate("json", createBotSchema), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillIds, mcpServerIds, ...fields } = c.req.valid("json");
    const [updated] = await db
      .update(bot)
      .set(fields)
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, userId)))
      .returning();
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    await setBotIntegrations(db, userId, updated.id, skillIds, mcpServerIds);
    return c.json({ bot: updated });
  })

  // The model picked in the prompt bar, saved so it is still selected after a refresh or on another device.
  // Its own route: the avatar form (PATCH above) must never overwrite it, nor this the avatar.
  .put("/:id/model", userLimit, validate("json", setBotModelSchema), async (c) => {
    const { db } = getRequestContext(c);
    const { modelId, reasoningEffort } = c.req.valid("json");
    const invalid = modelError(modelId, reasoningEffort);
    if (invalid) return c.json({ error: "INVALID_INPUT", message: invalid }, 400);
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
    if (!(await ownedBotId(db, userId, id))) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);

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

export default manage;
