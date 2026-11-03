"use client";

import { useCallback } from "react";
import type { FileRef } from "@/features/chat/lib/protocol";
import { connectImpl } from "./connect";
import { deliverImpl } from "./deliver";
import { toInfo } from "./helpers";
import { retryImpl } from "./retry";
import { sendImpl } from "./send";
import type { ChatCtx, ChatState } from "./types";
export function useChatActionsSend(
  state: ChatState,
  botId: string,
  ctxRef: React.MutableRefObject<ChatCtx | null>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const deliver = useCallback(
    (
      threadId: string,
      content: string,
      messageId: string,
      rerun = false,
      files?: FileRef[],
    ) =>
      deliverImpl(ctxRef.current!, threadId, content, messageId, rerun, files),
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const send = useCallback(
    (text: string, files: FileRef[] = []) =>
      sendImpl(ctxRef.current!, botId, text, files),
    [botId],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const retry = useCallback(
    (messageId: string, manual = true) =>
      retryImpl(ctxRef.current!, messageId, manual),
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const flush = useCallback(async () => {
    for (const item of state.outboxRef.current) {
      if (item.state === "failed" && item.error?.kind === "network") {
        await retry(item.id, false);
      }
    }
  }, [retry, state.outboxRef]);
  return { deliver, send, retry, flush };
}
