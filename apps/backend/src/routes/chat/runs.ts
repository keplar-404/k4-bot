import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { getRequestContext } from "../../lib/context";
import { getOwnedThread, quotaExceeded } from "../../lib/threads";
import { validate } from "../../lib/validate";
import { resumeRunSchema, sendMessageSchema } from "../../lib/schemas/chat";
import { userLimit } from "../../middleware/rate-limit";
import type { AuthGuardEnv } from "../../middleware/auth-guard";
import { resolveModel } from "../../agent/models";
import { chatMessage, chatThread } from "../../db/schema";
import type { ChatRunParams } from "../../workflows/chat-run";

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

      if (data.modelId) {
        const model = resolveModel(data.modelId);
        if (!model) return c.json({ error: "INVALID_INPUT", message: "Unknown model" }, 400);
        if (data.reasoningEffort && !model.reasoningEfforts.includes(data.reasoningEffort)) {
          return c.json({ error: "INVALID_INPUT", message: "Unsupported reasoning effort" }, 400);
        }
      }

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
  )

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
      const { threadId: _threadId, ...payload } = body;
      await instance.sendEvent({ type: "user-input", payload });
      return c.json({ ok: true, runId }, 202);
    },
  );

export default runs;
