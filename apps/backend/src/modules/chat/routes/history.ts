import { Hono } from "hono";
import { and, desc, eq, inArray, lt, max } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { getOwnedThread, tokensUsedToday } from "../threads";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { chatEvent, chatMessage } from "../../../db/schema";

const RUN_LIFECYCLE = ["run.waiting_approval", "run.waiting_input", "run.sleeping", "run.resumed", "run.done", "run.failed"];
const PENDING = new Set(["run.waiting_approval", "run.waiting_input", "run.sleeping"]);

const history = new Hono<AuthGuardEnv>()
  // History, newest page first, plus the event cursor the live stream resumes from.
  .get("/threads/:id/messages", async (c) => {
    const { db, env } = getRequestContext(c);
    const threadId = c.req.param("id");
    const userId = c.get("session").user.id;
    const thread = await getOwnedThread(db, threadId, userId);
    if (!thread) return c.json({ error: "NOT_FOUND" }, 404);

    const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);
    const before = Number(c.req.query("before"));

    // Both reads are issued together; the socket replays from lastSeq, so any
    // event landing in between is delivered there rather than lost.
    const [[last], rows, [lifecycle], todayUsed] = await Promise.all([
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
      // Where the run stands, so a reloaded page still shows an open question, approval or sleep.
      db
        .select({ type: chatEvent.type, payload: chatEvent.payload })
        .from(chatEvent)
        .where(and(eq(chatEvent.threadId, threadId), inArray(chatEvent.type, RUN_LIFECYCLE)))
        .orderBy(desc(chatEvent.seq))
        .limit(1),
      tokensUsedToday(db, userId),
    ]);
    const pending = lifecycle && PENDING.has(lifecycle.type) ? lifecycle : null;

    c.header("Cache-Control", "no-store");
    return c.json({
      messages: rows.slice(0, limit).reverse(),
      hasMore: rows.length > limit,
      lastSeq: Number(last?.lastSeq ?? 0),
      pending,
      // The context meter as of the last model call (the live stream updates it while a run works).
      usage: { contextTokens: thread.contextTokens, todayUsed, todayLimit: env.MAX_DAILY_TOKENS_PER_USER },
    });
  });

export default history;
