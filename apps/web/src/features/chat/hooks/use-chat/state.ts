"use client";
import { useCallback, useRef } from "react";
import type { StoreApi } from "zustand";
import type { ModelRow } from "@/features/chat/lib/client";
import type { OutboxItem } from "@/features/chat/lib/outbox";
import type {
  ChatErrorInfo,
  ChatMessageView,
  RunState,
} from "@/features/chat/lib/protocol";
import {
  initialStreamState,
  type StreamState,
} from "@/features/chat/lib/stream";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** One chat view's live state: everything the stream, history and controls change. */
type ChatData = {
  messages: ChatMessageView[];
  run: RunState;
  approval: StreamState["approval"];
  prompt: StreamState["prompt"];
  sleeping: StreamState["sleeping"];
  usage: StreamState["usage"];
  connection: string;
  error: ChatErrorInfo | null;
  isLoading: boolean;
  models: ModelRow[];
  modelId: string | undefined;
  reasoningEffort: string | null;
  mode: "allow_all" | "plan" | "ask";
};

const initialChat = (): ChatData => ({
  messages: [],
  run: "idle",
  approval: null,
  prompt: null,
  sleeping: null,
  usage: null,
  connection: "idle",
  error: null,
  isLoading: true,
  models: [],
  modelId: undefined,
  reasoningEffort: null,
  mode: "ask",
});

/** The setters keep useState's signature, so the action modules are unchanged. */
function makeSetters(store: StoreApi<ChatData>) {
  return {
    setMessages: fieldSetter(store, "messages"),
    setRun: fieldSetter(store, "run"),
    setApproval: fieldSetter(store, "approval"),
    setPrompt: fieldSetter(store, "prompt"),
    setSleeping: fieldSetter(store, "sleeping"),
    setUsage: fieldSetter(store, "usage"),
    setConnection: fieldSetter(store, "connection"),
    setError: fieldSetter(store, "error"),
    setIsLoading: fieldSetter(store, "isLoading"),
    setModels: fieldSetter(store, "models"),
    setModelId: fieldSetter(store, "modelId"),
    setReasoningEffort: fieldSetter(store, "reasoningEffort"),
    setMode: fieldSetter(store, "mode"),
  };
}

/**
 * The chat's state lives in a Zustand store (one per chat view: socket events, history, sends and controls all
 * write to it, and the view re-renders from it). The refs below are connection plumbing, not UI state.
 */
export function useChatState() {
  const [data, , store] = useLocalStore<ChatData>(initialChat);
  const settersRef = useRef<ReturnType<typeof makeSetters> | null>(null);
  settersRef.current ??= makeSetters(store);
  const setters = settersRef.current;
  const {
    messages,
    run,
    approval,
    prompt,
    sleeping,
    usage,
    connection,
    error,
    isLoading,
    models,
    modelId,
    reasoningEffort,
    mode,
  } = data;
  const {
    setMessages,
    setRun,
    setApproval,
    setPrompt,
    setSleeping,
    setConnection,
    setError,
    setIsLoading,
    setModels,
    setModelId,
    setReasoningEffort,
    setMode,
  } = setters;
  const modelIdRef = useRef<string | undefined>(undefined);
  const reasoningEffortRef = useRef<string | undefined>(undefined);
  const streamRef = useRef<StreamState>(initialStreamState());
  const wsRef = useRef<WebSocket | null>(null);
  const threadRef = useRef<string | null>(null);
  /** The run the last sent message started (what Stop stops). */
  const runIdRef = useRef<string | null>(null);
  const attemptsRef = useRef(0);
  const closedRef = useRef(false);
  const outboxRef = useRef<OutboxItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(new Set<string>());
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  /** One store update for a stream event (one re-render, not six). */
  const sync = useCallback(() => {
    const st = streamRef.current;
    store.setState({
      messages: st.messages,
      run: st.run,
      approval: st.approval,
      prompt: st.prompt,
      sleeping: st.sleeping,
      usage: st.usage,
    });
  }, [store]);
  return {
    store,
    messages,
    setMessages,
    run,
    setRun,
    approval,
    setApproval,
    prompt,
    setPrompt,
    sleeping,
    setSleeping,
    usage,
    connection,
    setConnection,
    error,
    setError,
    isLoading,
    setIsLoading,
    models,
    setModels,
    modelId,
    setModelId,
    reasoningEffort,
    setReasoningEffort,
    mode,
    setMode,
    modelIdRef,
    reasoningEffortRef,
    streamRef,
    wsRef,
    threadRef,
    runIdRef,
    attemptsRef,
    closedRef,
    outboxRef,
    timerRef,
    resendTimerRef,
    inflightRef,
    flushRef,
    saveTimerRef,
    pendingSaveRef,
    sync,
  };
}
