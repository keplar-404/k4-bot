import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { getOwnedThread } from "../threads";
import { validate } from "../../../shared/validate";
import { stopRunSchema } from "../schemas";
import { userLimit } from "../../../middleware/rate-limit";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { chatMessage } from "../../../db/schema";
import { publishEvent } from "../run/relay";

const stop = new Hono<AuthGuardEnv>()
  // Stop a run now. A run that is working notices the flag within about half a second, aborts the model call and
  // its tools, saves what it had produced and ends itself. A run that is only waiting (for an approval, an answer,
  // a sleep or a model retry) is ended here, since nothing is running to notice.
  .post("/runs/:runId/stop", userLimit, validate("json", stopRunSchema), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const runId = c.req.param("runId");
    const { threadId } = c.req.valid("json");

    if (!(await getOwnedThread(db, threadId, userId))) return c.json({ error: "NOT_FOUND" }, 404);
    // The run must belong to that thread (a run's first rows exist once its user message is saved).
    const [owned] = await db
      .select({ id: chatMessage.id })
      .from(chatMessage)
      .where(and(eq(chatMessage.threadId, threadId), eq(chatMessage.runId, runId)))
      .limit(1);
    if (!owned) return c.json({ error: "NOT_FOUND" }, 404);

    await env.CHAT_RELAY.get(env.CHAT_RELAY.idFromName(threadId)).requestStop(runId);

    const instance = await env.CHAT_RUN.get(runId).catch(() => null);
    const status = instance ? (await instance.status().catch(() => null))?.status : null;
    if (instance && status === "waiting") {
      await instance.terminate().catch(() => undefined);
      await publishEvent(env, threadId, "run.stopped", { runId, messageId: `${runId}:assistant` });
    }
    return c.json({ ok: true, runId }, 202);
  });

export default stop;
