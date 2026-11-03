import { resumeRun } from "@/features/chat/lib/client";
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
