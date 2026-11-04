"use client";
import { useCallback, useRef, useState } from "react";
import type { ModelRow } from "@/features/chat/lib/client";
import {
  backoffMs,
  canRetry,
  type OutboxItem,
} from "@/features/chat/lib/outbox";
import {
  type ChatErrorInfo,
  type ChatMessageView,
  type FileRef,
  networkError,
  type RunState,
} from "@/features/chat/lib/protocol";
import {
  applyPending,
  initialStreamState,
  mergeToolParts,
  reduceEvent,
  type StreamState,
  textOfParts,
  type WireEvent,
} from "@/features/chat/lib/stream";
export function useChatState() {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [run, setRun] = useState<RunState>("idle");
  const [approval, setApproval] = useState<StreamState["approval"]>(null);
  const [prompt, setPrompt] = useState<StreamState["prompt"]>(null);
  const [sleeping, setSleeping] = useState<StreamState["sleeping"]>(null);
  const [usage, setUsage] = useState<StreamState["usage"]>(null);
  const [connection, setConnection] = useState<string>("idle");
  const [error, setError] = useState<ChatErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);
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
  const sync = useCallback(() => {
    setMessages(streamRef.current.messages);
    setRun(streamRef.current.run);
    setApproval(streamRef.current.approval);
    setPrompt(streamRef.current.prompt);
    setSleeping(streamRef.current.sleeping);
    setUsage(streamRef.current.usage);
  }, []);
  return {
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
