import type { ChatCtx } from "./types";
export async function retryImpl(
  ctx: ChatCtx,
  messageId: string,
  manual = true,
): Promise<void> {
  const threadId = ctx.threadRef.current;
  const all = ctx.streamRef.current.messages;
  const target = all.find((m) => m.id === messageId);
  if (!threadId || !target) return;

  const question =
    target.role === "user"
      ? target
      : all
          .slice(0, all.indexOf(target))
          .reverse()
          .find((m) => m.role === "user");
  if (!question) return;

  const queued = ctx.outboxRef.current.find((i) => i.id === question.id);
  if (!manual && queued && !ctx.canRetry(queued)) return;
  if (manual && queued) {
    ctx.outboxRef.current = ctx.outboxRef.current.map((i) =>
      i.id === queued.id ? { ...i, attempts: 0 } : i,
    );
  }

  ctx.setError(null);
  ctx.streamRef.current = {
    ...ctx.streamRef.current,
    run: "idle",
    messages: all
      .filter((m) => m.role === "user" || m.id !== messageId)
      .map((m) =>
        m.id === question.id && target.role === "user"
          ? { ...m, state: "sending", error: undefined }
          : m,
      ),
  };
  ctx.sync();
  await ctx.deliver(
    threadId,
    question.text,
    question.id,
    target.role === "assistant",
    question.files,
  );
}
