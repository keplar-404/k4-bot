import { createThread } from "@/features/chat/lib/client";
import type { FileRef } from "@/features/chat/lib/protocol";
import type { ChatCtx } from "./types";

export async function sendImpl(
  ctx: ChatCtx,
  botId: string,
  text: string,
  files: FileRef[] = [],
): Promise<void> {
  const content = text.trim();
  if (!content && files.length === 0) return;
  ctx.setError(null);

  let threadId = ctx.threadRef.current;
  if (!threadId) {
    try {
      const { thread } = await createThread(botId, ctx.mode);
      threadId = thread.id;
      ctx.threadRef.current = threadId;
      void ctx.connect(threadId);
    } catch (e) {
      ctx.setError(ctx.toInfo(e));
      return;
    }
  }

  const id = crypto.randomUUID();
  ctx.streamRef.current = {
    ...ctx.streamRef.current,
    messages: [
      ...ctx.streamRef.current.messages,
      {
        id,
        role: "user",
        text: content,
        ...(files.length ? { files } : {}),
        state: "sending",
        createdAt: Date.now(),
      },
    ],
  };
  ctx.sync();

  ctx.outboxRef.current = [
    ...ctx.outboxRef.current,
    {
      id,
      threadId,
      content,
      ...(files.length ? { files } : {}),
      createdAt: Date.now(),
      attempts: 0,
      state: "sending",
    },
  ];
  ctx.persistOutbox(threadId, ctx.outboxRef.current);
  await ctx.deliver(threadId, content, id, false, files);
}
