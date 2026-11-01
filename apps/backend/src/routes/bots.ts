import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getRequestContext } from "../lib/context";
import { validate } from "../lib/validate";
import { createBotSchema } from "../lib/schemas/bot";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { userLimit } from "../middleware/rate-limit";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
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

  .delete("/:id", async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");

    const threads = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.botId, id), eq(chatThread.userId, userId)));
    const [deleted] = await db
      .delete(bot)
      .where(and(eq(bot.id, id), eq(bot.userId, userId)))
      .returning({ id: bot.id });

    // Threads cascade with the bot; agent checkpoints are keyed by thread id
    // without a foreign key, so they are removed explicitly.
    if (deleted) {
      const checkpointer = new NeonHttpCheckpointer(db);
      await Promise.all(threads.map((t) => checkpointer.deleteThread(t.id)));
    }
    return c.json({ ok: true });
  });

export default bots;
