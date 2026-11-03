import { getMessages } from "@/features/chat/lib/client";
import { applyPending, initialStreamState } from "@/features/chat/lib/stream";
import { persistOutbox, readOutbox } from "./outbox";
import { rowsToViews } from "./rows-to-views";
import type { ChatCtx } from "./types";

export async function loadHistoryImpl(
  ctx: ChatCtx,
  threadId: string,
): Promise<void> {
  const {
    messages: rows,
    lastSeq,
    pending,
    usage,
  } = await getMessages(threadId);
  const stored = new Set(rows.map((r) => r.id));

  ctx.outboxRef.current = readOutbox(threadId).filter((i) => !stored.has(i.id));
  const unsent = ctx.outboxRef.current.map((i) => ({
    id: i.id,
    role: "user" as const,
    text: i.content,
    files: i.files,
    state: "failed" as const,
    createdAt: i.createdAt,
    error: i.error ?? ctx.networkError(),
  }));
  persistOutbox(threadId, ctx.outboxRef.current);

  ctx.streamRef.current = applyPending(
    initialStreamState(
      [...rowsToViews(rows), ...unsent],
      lastSeq,
      usage ?? null,
    ),
    pending,
  );
  ctx.sync();
}
