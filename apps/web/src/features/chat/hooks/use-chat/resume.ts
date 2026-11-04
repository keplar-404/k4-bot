import { resumeRun, stopRun } from "@/features/chat/lib/client";
import type { ChatCtx } from "./types";

export async function decideImpl(
  ctx: ChatCtx,
  type: "approve" | "reject",
): Promise<void> {
  const threadId = ctx.threadRef.current;
  const pending = ctx.streamRef.current.approval;
  if (!threadId || !pending) return;
  try {
    await resumeRun(pending.runId, threadId, {
      decisions: pending.actions.map(() => ({ type })),
    });
    ctx.streamRef.current = {
      ...ctx.streamRef.current,
      run: "running",
      approval: null,
    };
    ctx.sync();
  } catch (e) {
    ctx.setError(ctx.toInfo(e));
  }
}

export async function answerImpl(ctx: ChatCtx, text: string): Promise<void> {
  const threadId = ctx.threadRef.current;
  const pending = ctx.streamRef.current.prompt;
  const reply = text.trim();
  if (!threadId || !pending || !reply) return;
  try {
    await resumeRun(pending.runId, threadId, { answer: reply });
    ctx.streamRef.current = {
      ...ctx.streamRef.current,
      run: "running",
      prompt: null,
    };
    ctx.sync();
  } catch (e) {
    ctx.setError(ctx.toInfo(e));
  }
}

/** Stop: ends the current run now. The chat is told by the run's own `run.stopped` event. */
export async function stopImpl(ctx: ChatCtx): Promise<void> {
  const threadId = ctx.threadRef.current;
  const s = ctx.streamRef.current;
  const runId =
    ctx.runIdRef.current ??
    s.approval?.runId ??
    s.prompt?.runId ??
    s.draftId?.replace(/:assistant$/, "");
  if (!threadId || !runId) return;
  try {
    await stopRun(runId, threadId);
  } catch (e) {
    ctx.setError(ctx.toInfo(e));
  }
}
