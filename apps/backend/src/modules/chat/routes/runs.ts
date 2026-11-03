import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { getOwnedThread, quotaExceeded } from "../threads";
import { validate } from "../../../shared/validate";
import { sendMessageSchema } from "../schemas";
import { userLimit } from "../../../middleware/rate-limit";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { modelError } from "../../agent/models";
import { chatThread } from "../../../db/schema";
import type { ChatRunParams } from "../run/workflow";

const runs = new Hono<AuthGuardEnv>()
  // Start a run. Returns 202 immediately; the answer streams over the socket.
  .post(
    "/threads/:id/messages",
    userLimit,
    validate("json", sendMessageSchema),
    async (c) => {
      const { db, env } = getRequestContext(c);
      const userId = c.get("session").user.id;
      const threadId = c.req.param("id");
      const data = c.req.valid("json");

      if (!(await getOwnedThread(db, threadId, userId))) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      const invalid = data.modelId ? modelError(data.modelId, data.reasoningEffort) : null;
      if (invalid) return c.json({ error: "INVALID_INPUT", message: invalid }, 400);

      const quota = await quotaExceeded(db, env, userId);
      if (quota) return c.json({ error: "QUOTA_EXCEEDED", message: quota }, 402);

      // The run id is the message id, so a resend of a message the server
      // already accepted (its response was lost on a dropped connection) is a
      // no-op. Only an explicit retry of a failed answer starts a new run.
      const userMessageId = data.messageId ?? crypto.randomUUID();
      const runId = data.retry ? crypto.randomUUID() : userMessageId;
      try {
        await env.CHAT_RUN.create({
          id: runId,
          params: {
            runId,
            threadId,
            userId,
            userMessageId,
            content: data.content,
            fileIds: data.fileIds,
            modelId: data.modelId,
            reasoningEffort: data.reasoningEffort,
            compact: data.compact,
          } satisfies ChatRunParams,
        });
      } catch (error) {
        const existing = await env.CHAT_RUN.get(runId).catch(() => null);
        if (!existing) throw error;
        return c.json({ runId, userMessageId }, 202);
      }

      // The first message names the thread; any update bumps updatedAt.
      await db
        .update(chatThread)
        .set({
          title: sql`case when ${chatThread.title} = 'New chat' then ${(data.content.trim() || "Files").slice(0, 80)} else ${chatThread.title} end`,
        })
        .where(eq(chatThread.id, threadId));

      return c.json({ runId, userMessageId }, 202);
    },
  );

export default runs;
