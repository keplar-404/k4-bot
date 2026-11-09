import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { getOwnedThread, quotaExceeded } from "../threads";
import { validate } from "../../../shared/validate";
import { sendMessageSchema } from "../schemas";
import { userLimit } from "../../../middleware/rate-limit";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { DEFAULT_MODEL_ID, isFreeModel, modelError } from "../../agent/models";
import { chatThread } from "../../../db/schema";
import type { ChatRunParams } from "../run/workflow";
import { threadBusy } from "../run-busy";
import { deepResearchQuestion } from "../commands";
import { addressed } from "../../groups/mentions";
import { getOwnedGroup, groupMembers, leadOf } from "../../groups/store";
import type { Db } from "../../../db";

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

      const thread = await getOwnedThread(db, threadId, userId);
      if (!thread) return c.json({ error: "NOT_FOUND" }, 404);
      // A group chat: the bots named with @bot:name answer in order; otherwise the lead does.
      const turns = thread.groupId ? await groupTurns(db, userId, thread.groupId, data.content) : null;
      if (thread.groupId && !turns) return c.json({ error: "NOT_FOUND", message: "This group has no bots." }, 404);

      // /deep-research needs a question: an empty one would spend a research task on nothing.
      const question = deepResearchQuestion(data.content);
      if (question === "") return c.json({ error: "INVALID_INPUT", message: "Write your research question after /deep-research." }, 400);

      const invalid = data.modelId ? modelError(data.modelId, data.reasoningEffort) : null;
      if (invalid) return c.json({ error: "INVALID_INPUT", message: invalid }, 400);

      // Free models are not limited here (OpenRouter limits them itself, and the chat explains its errors).
      const quota = isFreeModel(data.modelId ?? DEFAULT_MODEL_ID) ? null : await quotaExceeded(db, env, userId);
      if (quota) return c.json({ error: "QUOTA_EXCEEDED", message: quota }, 402);

      // One run at a time per thread: two would share one checkpoint and interleave their messages.
      const runId0 = data.retry ? null : (data.messageId ?? null);
      if (await threadBusy(env, db, threadId, runId0)) {
        return c.json({ error: "RUN_ACTIVE", message: "The bot is still working on your last message." }, 409);
      }

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
            research: question !== null || undefined,
            ...(turns ? { botId: turns[0]!.id, queue: turns.slice(1).map((m) => ({ botId: m.id, task: data.content, from: "User" })) } : {}),
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

/** The group members a message addresses, in order (the lead when it names nobody); null for an empty group. */
async function groupTurns(db: Db, userId: string, groupId: string, content: string) {
  const group = await getOwnedGroup(db, userId, groupId);
  const members = group ? await groupMembers(db, group.id) : [];
  const lead = group ? leadOf(group, members) : null;
  return lead ? addressed(content, members, lead) : null;
}

export default runs;
