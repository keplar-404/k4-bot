import { sendMessage } from "@/features/chat/lib/client";
import { backoffMs, canRetry } from "@/features/chat/lib/outbox";
import type { ChatMessageView, FileRef } from "@/features/chat/lib/protocol";
import type { ChatCtx } from "./types";

export async function deliverImpl(
  ctx: ChatCtx,
  threadId: string,
  content: string,
  messageId: string,
  rerun = false,
  files?: FileRef[],
): Promise<void> {
  if (ctx.inflightRef.current.has(messageId)) return;
  ctx.inflightRef.current.add(messageId);
  try {
    const started = await sendMessage({
      threadId,
      messageId,
      content,
      fileIds: files?.length ? files.map((f) => f.id) : undefined,
      modelId: ctx.modelIdRef.current,
      reasoningEffort: ctx.reasoningEffortRef.current,
      retry: rerun || undefined,
      compact: content.trim() === "/compact" || undefined,
    });
    ctx.runIdRef.current = started.runId;
    ctx.streamRef.current = {
      ...ctx.streamRef.current,
      run: "running",
      messages: ctx.streamRef.current.messages.map((m) =>
        m.id === messageId ? { ...m, state: "sent", error: undefined } : m,
      ),
    };
    ctx.sync();
    ctx.outboxRef.current = ctx.outboxRef.current.filter(
      (i) => i.id !== messageId,
    );
    ctx.persistOutbox(threadId, ctx.outboxRef.current);
    if (!ctx.wsRef.current || ctx.wsRef.current.readyState > 1)
      void ctx.connect(threadId);
  } catch (e) {
    const info = ctx.toInfo(e);
    ctx.streamRef.current = {
      ...ctx.streamRef.current,
      messages: ctx.streamRef.current.messages.map((m) =>
        m.id === messageId ? { ...m, state: "failed", error: info } : m,
      ),
    };
    ctx.sync();
    ctx.outboxRef.current = ctx.outboxRef.current.map((i) =>
      i.id === messageId
        ? { ...i, state: "failed", attempts: i.attempts + 1, error: info }
        : i,
    );
    ctx.persistOutbox(threadId, ctx.outboxRef.current);
    ctx.setError(info);

    const item = ctx.outboxRef.current.find((i) => i.id === messageId);
    if (info.kind === "network" && item && canRetry(item)) {
      if (ctx.resendTimerRef.current) clearTimeout(ctx.resendTimerRef.current);
      ctx.resendTimerRef.current = setTimeout(
        () => void ctx.flushRef.current(),
        backoffMs(item.attempts),
      );
    }
  } finally {
    ctx.inflightRef.current.delete(messageId);
  }
}
