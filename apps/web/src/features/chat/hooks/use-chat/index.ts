"use client";

import { useRef } from "react";
import { fetchBot } from "@/features/bots/api";
import { listModels, listThreads } from "@/features/chat/lib/client";
import { backoffMs, canRetry } from "@/features/chat/lib/outbox";
import { networkError } from "@/features/chat/lib/protocol";
import { initialStreamState } from "@/features/chat/lib/stream";
import { useChatActions } from "./actions";
import { FATAL, toInfo } from "./helpers";
import { readOutbox } from "./outbox";
import { rowsToViews } from "./rows-to-views";
import { useChatState } from "./state";
import type { ChatCtx } from "./types";
import { useHydration } from "./use-hydration";
import { useModels } from "./use-models";
import { useOnline } from "./use-online";
import { useSaveCleanup } from "./use-save-cleanup";

export type Connection =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "offline";

export function useChat(botId: string, groupId?: string) {
  const state = useChatState();
  const ctxRef = useRef<ChatCtx | null>(null);

  const actions = useChatActions(state, botId, ctxRef);

  ctxRef.current = {
    ctxRef,
    botId,
    groupId,
    ...state,
    ...actions,
    FATAL,
    toInfo,
    networkError,
    initialStreamState,
    listThreads,
    listModels,
    fetchBot,
    readOutbox,
    backoffMs,
    canRetry,
    rowsToViews,
    reload: actions.reload,
    persistOutbox: actions.persistOutboxCb,
  };

  useHydration(ctxRef, botId, groupId);
  useOnline(ctxRef);
  useModels(ctxRef, botId);
  useSaveCleanup(state.saveTimerRef, state.pendingSaveRef);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    run: state.run,
    approval: state.approval,
    prompt: state.prompt,
    sleeping: state.sleeping,
    usage: state.usage,
    answer: actions.answer,
    stop: actions.stop,
    connection: state.connection,
    error: state.error,
    models: state.models,
    modelId: state.modelId,
    reasoningEffort: state.reasoningEffort,
    mode: state.mode,
    chooseModel: actions.chooseModel,
    setMode: actions.changeMode,
    send: actions.send,
    retry: actions.retry,
    dismissError: actions.dismissError,
    approve: actions.approve,
    reject: actions.reject,
  };
}
