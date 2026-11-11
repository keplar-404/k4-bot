import { Hono } from "hono";
import { z } from "zod";
import { type AuthGuardEnv, authGuard } from "../../middleware/auth-guard";
import { assistantMessageLimit, userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { modelError } from "../agent/models";
import { tokensUsedToday } from "../chat/threads";
import { getWorkflow } from "../workflows/store/workflows";
import { assistantRun } from "../../db/schema";
import { messageBody } from "./limits";
import {
  activeRunOf,
  addMessage,
  createThread,
  deleteThread,
  getRunRow,
  getThread,
  latestRunOf,
  listThreads,
  loadMemory,
  saveMemory,
  setRun,
  threadMessages,
  updateThread,
} from "./store";

const id = z.uuid();
const BUSY = { error: "BUSY", message: "The assistant is already working. Wait for it, or press Stop." } as const;

/** Postgres error 23505: the unique rule refused the row (the driver may wrap it, so its cause is checked too). */
const isUniqueViolation = (e: unknown): boolean =>
  (e as { code?: string })?.code === "23505" || (e as { cause?: { code?: string } })?.cause?.code === "23505";
const NOT_FOUND = { error: "NOT_FOUND", message: "Chat not found." } as const;

/** The workflow builder's assistant (/api/v1/assistant): the user's chats, their runs, and its memory. */
const assistant = new Hono<AuthGuardEnv>()
  .use("*", authGuard)

  .get("/threads", validate("query", z.object({ before: z.iso.datetime().optional() })), async (c) => {
    const { db } = getRequestContext(c);
    return c.json({ items: await listThreads(db, c.get("session").user.id, c.req.valid("query").before) });
  })

  .post("/threads", userLimit, validate("json", z.object({ workflowId: id.optional() })), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { workflowId } = c.req.valid("json");
    if (workflowId && !(await getWorkflow(db, userId, workflowId))) return c.json({ error: "NOT_FOUND", message: "Workflow not found." }, 404);
    return c.json(await createThread(db, userId, workflowId ?? null), 201);
  })

  // A chat with its messages and its latest run: what a reopened page shows (a run may still be working).
  .get("/threads/:id", validate("param", z.object({ id })), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const thread = await getThread(db, userId, c.req.valid("param").id);
    if (!thread) return c.json(NOT_FOUND, 404);
    const [messages, run] = await Promise.all([threadMessages(db, userId, thread.id), latestRunOf(db, userId, thread.id)]);
    return c.json({ thread, messages, run });
  })

  .patch("/threads/:id", userLimit, validate("param", z.object({ id })), validate("json", z.object({ title: z.string().trim().min(1).max(80) })), async (c) => {
    const { db } = getRequestContext(c);
    const row = await updateThread(db, c.get("session").user.id, c.req.valid("param").id, c.req.valid("json"));
    return row ? c.json(row) : c.json(NOT_FOUND, 404);
  })

  .delete("/threads/:id", userLimit, validate("param", z.object({ id })), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const threadId = c.req.valid("param").id;
    const active = await activeRunOf(db, userId);
    if (active?.threadId === threadId) return c.json({ error: "BUSY", message: "Stop the assistant before deleting this chat." }, 409);
    return (await deleteThread(db, userId, threadId)) ? c.json({ ok: true }) : c.json(NOT_FOUND, 404);
  })

  // Send a message: starts a run in the cloud (it goes on if the tab closes). One run per user at a time.
  .post("/threads/:id/messages", assistantMessageLimit, validate("param", z.object({ id })), validate("json", messageBody), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const body = c.req.valid("json");
    const thread = await getThread(db, userId, c.req.valid("param").id);
    if (!thread) return c.json(NOT_FOUND, 404);
    if (!(await getWorkflow(db, userId, body.workflowId))) return c.json({ error: "NOT_FOUND", message: "Workflow not found." }, 404);
    const modelId = body.modelId ?? thread.modelId ?? undefined;
    if (modelId && modelError(modelId)) return c.json({ error: "BAD_MODEL", message: "Choose a model from the list." }, 400);
    if (await activeRunOf(db, userId)) {
      return c.json(BUSY, 409);
    }
    if ((await tokensUsedToday(db, userId)) >= env.MAX_DAILY_TOKENS_PER_USER) {
      return c.json({ error: "BUDGET", message: "Today's token budget is used up. It resets at 00:00 UTC." }, 429);
    }

    const runId = crypto.randomUUID();
    // Only the user's own uploads are kept on the message (the run reads files through the owner too).
    const files = body.files.filter((f) => body.fileIds.includes(f.id));
    // The run row goes first: a database rule allows one working run per user, so of two messages sent at the same
    // instant only one gets here, and the other is refused before anything is saved.
    try {
      await db.insert(assistantRun).values({ id: runId, threadId: thread.id, userId, workflowId: body.workflowId });
    } catch (error) {
      if (isUniqueViolation(error)) return c.json(BUSY, 409);
      throw error;
    }
    await addMessage(db, { threadId: thread.id, userId, role: "user", content: body.content, files, runId });
    await updateThread(db, userId, thread.id, {
      workflowId: body.workflowId,
      ...(modelId ? { modelId } : {}),
      ...(thread.title === "New chat" ? { title: body.content.slice(0, 80) } : {}),
    });
    try {
      await env.ASSISTANT_RUN.create({
        id: runId,
        params: { runId, threadId: thread.id, userId, workflowId: body.workflowId, modelId, content: body.content, fileIds: body.fileIds },
      });
    } catch (error) {
      console.error("[assistant] could not start", error);
      await setRun(db, runId, { status: "failed", error: "Could not start", finishedAt: new Date() });
      return c.json({ error: "UNAVAILABLE", message: "Could not start the assistant. Try again in a moment." }, 503);
    }
    return c.json({ runId }, 202);
  })

  // The answer to a card (turn on, share, apps connected): the run goes on.
  .post("/runs/:id/answer", userLimit, validate("param", z.object({ id })), validate("json", z.object({ approved: z.boolean() })), async (c) => {
    const { db, env } = getRequestContext(c);
    const run = await getRunRow(db, c.req.valid("param").id);
    if (!run || run.userId !== c.get("session").user.id) return c.json(NOT_FOUND, 404);
    if (run.status !== "waiting") return c.json({ error: "NOT_WAITING", message: "The assistant is not waiting for an answer." }, 409);
    await (await env.ASSISTANT_RUN.get(run.id)).sendEvent({ type: "assistant-input", payload: { approved: c.req.valid("json").approved } });
    return c.json({ ok: true });
  })

  // Stop: the run ends at its next check (within seconds), keeping what it changed. The edit lock goes with it.
  .post("/runs/:id/stop", userLimit, validate("param", z.object({ id })), async (c) => {
    const { db, env } = getRequestContext(c);
    const run = await getRunRow(db, c.req.valid("param").id);
    if (!run || run.userId !== c.get("session").user.id) return c.json(NOT_FOUND, 404);
    if (!["queued", "running", "waiting"].includes(run.status)) return c.json({ ok: true });
    const wasWaiting = run.status === "waiting";
    await setRun(db, run.id, { status: "cancelled" });
    if (wasWaiting) await (await env.ASSISTANT_RUN.get(run.id)).sendEvent({ type: "assistant-input", payload: { stop: true } }).catch(() => undefined);
    return c.json({ ok: true });
  })

  .get("/memory", async (c) => {
    const { db } = getRequestContext(c);
    return c.json({ content: await loadMemory(db, c.get("session").user.id) });
  })

  .put("/memory", userLimit, validate("json", z.object({ content: z.string().max(8000) })), async (c) => {
    const { db } = getRequestContext(c);
    await saveMemory(db, c.get("session").user.id, c.req.valid("json").content);
    return c.json({ ok: true });
  });

export default assistant;
