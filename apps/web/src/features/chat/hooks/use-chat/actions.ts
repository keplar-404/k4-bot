"use client";

import { useCallback, useEffect } from "react";
import { useChatActionsMeta } from "./actions-meta";
import { useChatActionsSend } from "./actions-send";
import { connectImpl } from "./connect";
import { toInfo } from "./helpers";
import { loadHistoryImpl } from "./load-history";
import { persistOutbox } from "./outbox";

import type { ChatCtx, ChatState } from "./types";
export function useChatActions(
  state: ChatState,
  botId: string,
  ctxRef: React.MutableRefObject<ChatCtx | null>,
) {
  const sendActions = useChatActionsSend(state, botId, ctxRef);

  const persistOutboxCb = useCallback(
    (threadId: string) => persistOutbox(threadId, state.outboxRef.current),
    [state.outboxRef],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const loadHistory = useCallback(
    (threadId: string) => loadHistoryImpl(ctxRef.current!, threadId),
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const connect = useCallback(
    (threadId: string) => connectImpl(ctxRef.current!, threadId),
    [],
  );
  const reload = useCallback(async () => {
    const tid = state.threadRef.current;
    if (!tid) return;
    try {
      await loadHistory(tid);
    } catch (e) {
      state.setError(toInfo(e));
    }
  }, [loadHistory, state.threadRef, state.setError]);
  const flush = sendActions.flush;
  useEffect(() => {
    state.flushRef.current = flush;
  }, [flush, state.flushRef]);

  const meta = useChatActionsMeta(state, botId, ctxRef);

  return {
    persistOutboxCb,
    loadHistory,
    connect,
    reload,
    deliver: sendActions.deliver,
    send: sendActions.send,
    retry: sendActions.retry,
    flush,
    ...meta,
  };
}
