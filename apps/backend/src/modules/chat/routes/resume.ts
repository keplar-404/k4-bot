import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { getOwnedThread } from "../threads";
import { validate } from "../../../shared/validate";
import { resumeRunSchema } from "../schemas";
import { userLimit } from "../../../middleware/rate-limit";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { chatMessage } from "../../../db/schema";
import { setThreadMode } from "../thread-mode";

const resume = new Hono<AuthGuardEnv>()
  // Answer a paused run: approval decisions or the answer to a question. The run's workflow is
  // waiting for this event (and keeps an early one), so no new run is started.
  .post(
    "/runs/:runId/resume",
    userLimit,
    validate("json", resumeRunSchema),
    async (c) => {
      const { db, env } = getRequestContext(c);
      const userId = c.get("session").user.id;
      const runId = c.req.param("runId");
      const body = c.req.valid("json");

      if (!(await getOwnedThread(db, body.threadId, userId))) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      // The run must belong to that thread, or one user's thread would unlock another user's run.
      const [owned] = await db
        .select({ id: chatMessage.id })
        .from(chatMessage)
        .where(and(eq(chatMessage.threadId, body.threadId), eq(chatMessage.runId, runId)))
        .limit(1);
      if (!owned) return c.json({ error: "NOT_FOUND" }, 404);

      const instance = await env.CHAT_RUN.get(runId).catch(() => null);
      if (!instance) return c.json({ error: "NOT_FOUND" }, 404);
      // "Switch to Ask & continue": the mode is saved HERE, before the run is woken, so the next slice always sees it.
      const switched = "answer" in body ? /^switched:(ask|allow_all)$/.exec(body.answer)?.[1] : undefined;
      if (switched) await setThreadMode(db, env, userId, body.threadId, switched as "ask" | "allow_all");
      const { threadId: _threadId, ...payload } = body;
      await instance.sendEvent({ type: "user-input", payload });
      return c.json({ ok: true, runId }, 202);
    },
  );

export default resume;
