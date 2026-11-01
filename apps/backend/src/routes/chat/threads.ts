import { Hono } from "hono";
import { and, desc, eq, lt, max } from "drizzle-orm";
import { getRequestContext } from "../../lib/context";
import { getOwnedThread } from "../../lib/threads";
import { validate } from "../../lib/validate";
import { createThreadSchema } from "../../lib/schemas/chat";
import type { AuthGuardEnv } from "../../middleware/auth-guard";
import { bot, chatEvent, chatMessage, chatThread } from "../../db/schema";

const threads = new Hono<AuthGuardEnv>()
  // List a user's threads, newest first, cursor-paginated by updatedAt.
  .get("/threads", async (c) => {
    const { db } = getRequestContext(c);
    const botId = c.req.query("botId");
    const limit = Math.min(Number(c.req.query("limit") ?? "20") || 20, 50);
    const cursor = c.req.query("cursor");

    const rows = await db
      .select()
      .from(chatThread)
      .where(
        and(
          eq(chatThread.userId, c.get("session").user.id),
          botId ? eq(chatThread.botId, botId) : undefined,
          cursor ? lt(chatThread.updatedAt, new Date(cursor)) : undefined,
        ),
      )
      .orderBy(desc(chatThread.updatedAt))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    c.header("Cache-Control", "no-store");
    return c.json({
      threads: items,
      nextCursor: rows.length > limit ? items[items.length - 1]!.updatedAt.toISOString() : null,
    });
  })

  .post("/threads", validate("json", createThreadSchema), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const data = c.req.valid("json");

    const [owned] = await db
      .select({ id: bot.id })
      .from(bot)
      .where(and(eq(bot.id, data.botId), eq(bot.userId, userId)))
      .limit(1);
    if (!owned) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);

    const [created] = await db
      .insert(chatThread)
      .values({ id: crypto.randomUUID(), botId: data.botId, userId, title: data.title ?? "New chat" })
      .returning();
    return c.json({ thread: created }, 201);
  })

  // History, newest page first, plus the event cursor the live stream resumes from.
  .get("/threads/:id/messages", async (c) => {
    const { db } = getRequestContext(c);
    const threadId = c.req.param("id");
    if (!(await getOwnedThread(db, threadId, c.get("session").user.id))) {
      return c.json({ error: "NOT_FOUND" }, 404);
    }

    const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);
    const before = Number(c.req.query("before"));

    // Both reads are issued together; the socket replays from lastSeq, so any
    // event landing in between is delivered there rather than lost.
    const [[last], rows] = await Promise.all([
      db.select({ lastSeq: max(chatEvent.seq) }).from(chatEvent).where(eq(chatEvent.threadId, threadId)),
      db
        .select()
        .from(chatMessage)
        .where(
          and(
            eq(chatMessage.threadId, threadId),
            Number.isFinite(before) ? lt(chatMessage.seq, before) : undefined,
          ),
        )
        .orderBy(desc(chatMessage.seq))
        .limit(limit + 1),
    ]);

    c.header("Cache-Control", "no-store");
    return c.json({
      messages: rows.slice(0, limit).reverse(),
      hasMore: rows.length > limit,
      lastSeq: Number(last?.lastSeq ?? 0),
    });
  });

export default threads;
