"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatHttpError,
  createThread,
  getMessages,
  listModels,
  listThreads,
  type MessageRow,
  type ModelRow,
  mintToken,
  resumeRun,
  sendMessage,
  wsUrl,
} from "./client";
import { backoffMs, canRetry, type OutboxItem } from "./outbox";
import {
  type ChatErrorInfo,
  type ChatMessageView,
  networkError,
  type RunState,
} from "./protocol";
import {
  type ApprovalAction,
  initialStreamState,
  reduceEvent,
  type StreamState,
  type WireEvent,
} from "./stream";

export type Connection =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "offline";

const outboxKey = (threadId: string) => `k4:outbox:${threadId}`;

/** Errors a reconnect cannot fix: retrying forever would only hammer the API. */
const FATAL = new Set(["auth", "forbidden", "not_found"]);

function rowsToViews(rows: MessageRow[]): ChatMessageView[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role === "user" ? "user" : "assistant",
    text: (r.parts ?? [])
      .map((p) => (p.type === "text" ? String(p.text ?? "") : ""))
      .join(""),
    state: "sent",
    createdAt: new Date(r.createdAt).getTime() || Date.now(),
    seq: r.seq,
  }));
}

const toInfo = (err: unknown): ChatErrorInfo =>
  err instanceof ChatHttpError ? err.info : networkError();

function readOutbox(threadId: string): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(outboxKey(threadId)) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Chat transport for one bot's newest thread.
 *
 * Owns three things: the optimistic transcript, the outbox, and the socket.
 * The transcript is seeded from HTTP history together with the stream cursor
 * (`lastSeq`), and the socket resumes from that cursor, so history and live
 * events join without a gap or an overlap. Every failure path ends in a state
 * the UI can render.
 */
export function useChat(botId: string) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [run, setRun] = useState<RunState>("idle");
  const [approval, setApproval] = useState<StreamState["approval"]>(null);
  const [connection, setConnection] = useState<Connection>("idle");
  const [error, setError] = useState<ChatErrorInfo | null>(null);
  // True until the first history fetch settles: "0 messages" and "not loaded
  // yet" are different screens.
  const [isLoading, setIsLoading] = useState(true);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const modelIdRef = useRef<string | undefined>(undefined);
  const reasoningEffortRef = useRef<string | undefined>(undefined);

  const streamRef = useRef<StreamState>(initialStreamState());
  const wsRef = useRef<WebSocket | null>(null);
  const threadRef = useRef<string | null>(null);
  const attemptsRef = useRef(0);
  const closedRef = useRef(false);
  const outboxRef = useRef<OutboxItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Message ids with a send in flight: every resend trigger checks this first. */
  const inflightRef = useRef(new Set<string>());
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const sync = useCallback(() => {
    setMessages(streamRef.current.messages);
    setRun(streamRef.current.run);
    setApproval(streamRef.current.approval);
  }, []);

  const persistOutbox = useCallback((threadId: string) => {
    try {
      localStorage.setItem(
        outboxKey(threadId),
        JSON.stringify(outboxRef.current),
      );
    } catch {
      // storage refused: the in-memory queue still works for this session
    }
  }, []);

  /**
   * (Re)load history and move the cursor to match it. Messages the user typed
   * that the server has not stored yet stay on screen as failed bubbles with a
   * Retry, so a reload or a lost connection never swallows them.
   */
  const loadHistory = useCallback(
    async (threadId: string) => {
      const { messages: rows, lastSeq } = await getMessages(threadId);
      const stored = new Set(rows.map((r) => r.id));

      outboxRef.current = readOutbox(threadId).filter((i) => !stored.has(i.id));
      const unsent: ChatMessageView[] = outboxRef.current.map((i) => ({
        id: i.id,
        role: "user",
        text: i.content,
        state: "failed",
        createdAt: i.createdAt,
        error: i.error ?? networkError(),
      }));
      persistOutbox(threadId);

      streamRef.current = initialStreamState(
        [...rowsToViews(rows), ...unsent],
        lastSeq,
      );
      sync();
    },
    [persistOutbox, sync],
  );

  const reload = useCallback(async () => {
    const tid = threadRef.current;
    if (!tid) return;
    try {
      await loadHistory(tid);
    } catch (e) {
      setError(toInfo(e));
    }
  }, [loadHistory]);

  const connect = useCallback(
    async (threadId: string) => {
      if (closedRef.current) return;
      setConnection(attemptsRef.current > 0 ? "reconnecting" : "connecting");

      const scheduleRetry = () => {
        timerRef.current = setTimeout(
          () => void connect(threadId),
          backoffMs(attemptsRef.current++),
        );
      };

      try {
        const { token, userId } = await mintToken(threadId);
        if (closedRef.current) return;
        // The cursor is where the transcript ends: the relay replays anything
        // newer, so nothing is missed and nothing is shown twice.
        const ws = new WebSocket(
          wsUrl({ threadId, userId, token, lastSeq: streamRef.current.cursor }),
        );
        wsRef.current = ws;

        ws.onopen = () => {
          attemptsRef.current = 0;
          setConnection("open");
          // Back online: send whatever could not go out while we were away.
          void flushRef.current();
        };
        ws.onmessage = (event) => {
          let frame: { type?: string; event?: WireEvent };
          try {
            frame = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (frame.type === "resync") {
            void reload();
          } else if (frame.type === "event" && frame.event) {
            const result = reduceEvent(streamRef.current, frame.event);
            if (result.effect === "resync") {
              void reload();
              return;
            }
            streamRef.current = result.state;
            sync();
          }
        };
        ws.onclose = () => {
          if (closedRef.current) return;
          setConnection("reconnecting");
          scheduleRetry();
        };
        ws.onerror = () => ws.close();
      } catch (e) {
        const info = toInfo(e);
        setError(info);
        if (FATAL.has(info.kind)) {
          setConnection("offline");
          return;
        }
        setConnection(info.kind === "network" ? "offline" : "reconnecting");
        scheduleRetry();
      }
    },
    [reload, sync],
  );

  // Hydrate once per bot: newest thread + its history, then subscribe.
  useEffect(() => {
    closedRef.current = false;
    let cancelled = false;
    threadRef.current = null;
    streamRef.current = initialStreamState();
    outboxRef.current = [];
    sync();
    setIsLoading(true);
    setConnection("idle");

    void (async () => {
      try {
        const { threads } = await listThreads(botId);
        if (cancelled) return;
        const tid = threads[0]?.id;
        if (!tid) {
          setIsLoading(false); // nothing to stream until the first send
          return;
        }
        threadRef.current = tid;
        await loadHistory(tid);
        if (cancelled) return;
        setIsLoading(false);
        void connect(tid);
      } catch (e) {
        if (cancelled) return;
        setError(toInfo(e));
        setConnection("offline");
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      closedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
      wsRef.current?.close();
    };
  }, [botId, connect, loadHistory, sync]);

  /** `rerun`: re-ask a message whose answer failed (a new run, same message). */
  const deliver = useCallback(
    async (
      threadId: string,
      content: string,
      messageId: string,
      rerun = false,
    ) => {
      if (inflightRef.current.has(messageId)) return;
      inflightRef.current.add(messageId);
      try {
        await sendMessage({
          threadId,
          messageId,
          content,
          modelId: modelIdRef.current,
          reasoningEffort: reasoningEffortRef.current,
          retry: rerun || undefined,
        });
        streamRef.current = {
          ...streamRef.current,
          run: "running",
          messages: streamRef.current.messages.map((m) =>
            m.id === messageId ? { ...m, state: "sent", error: undefined } : m,
          ),
        };
        sync();
        outboxRef.current = outboxRef.current.filter((i) => i.id !== messageId);
        persistOutbox(threadId);
        if (!wsRef.current || wsRef.current.readyState > 1)
          void connect(threadId);
      } catch (e) {
        const info = toInfo(e);
        streamRef.current = {
          ...streamRef.current,
          messages: streamRef.current.messages.map((m) =>
            m.id === messageId ? { ...m, state: "failed", error: info } : m,
          ),
        };
        sync();
        outboxRef.current = outboxRef.current.map((i) =>
          i.id === messageId
            ? { ...i, state: "failed", attempts: i.attempts + 1, error: info }
            : i,
        );
        persistOutbox(threadId);
        setError(info);

        // A dropped connection resends itself, with growing delays, until the
        // attempts run out; after that the user's Retry takes over.
        const item = outboxRef.current.find((i) => i.id === messageId);
        if (info.kind === "network" && item && canRetry(item)) {
          if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
          resendTimerRef.current = setTimeout(
            () => void flushRef.current(),
            backoffMs(item.attempts),
          );
        }
      } finally {
        inflightRef.current.delete(messageId);
      }
    },
    [connect, persistOutbox, sync],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;
      setError(null);

      let threadId = threadRef.current;
      if (!threadId) {
        try {
          const { thread } = await createThread(botId);
          threadId = thread.id;
          threadRef.current = threadId;
          void connect(threadId);
        } catch (e) {
          setError(toInfo(e));
          return;
        }
      }

      const id = crypto.randomUUID();
      streamRef.current = {
        ...streamRef.current,
        messages: [
          ...streamRef.current.messages,
          {
            id,
            role: "user",
            text: content,
            state: "sending",
            createdAt: Date.now(),
          },
        ],
      };
      sync();

      // Written before the network call, so a reload cannot lose it.
      outboxRef.current = [
        ...outboxRef.current,
        {
          id,
          threadId,
          content,
          createdAt: Date.now(),
          attempts: 0,
          state: "sending",
        },
      ];
      persistOutbox(threadId);
      await deliver(threadId, content, id);
    },
    [botId, connect, deliver, persistOutbox, sync],
  );

  /**
   * Retry a failed user message, or a failed answer (which re-asks the last
   * question). The user message id is reused, so the server stores it once.
   */
  const retry = useCallback(
    async (messageId: string, manual = true) => {
      const threadId = threadRef.current;
      const all = streamRef.current.messages;
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

      // Automatic resends stop after a few attempts; a click always works and
      // starts the count again.
      const queued = outboxRef.current.find((i) => i.id === question.id);
      if (!manual && queued && !canRetry(queued)) return;
      if (manual && queued) {
        outboxRef.current = outboxRef.current.map((i) =>
          i.id === queued.id ? { ...i, attempts: 0 } : i,
        );
      }

      setError(null);
      streamRef.current = {
        ...streamRef.current,
        run: "idle",
        messages: all
          .filter((m) => m.role === "user" || m.id !== messageId)
          .map((m) =>
            m.id === question.id && target.role === "user"
              ? { ...m, state: "sending", error: undefined }
              : m,
          ),
      };
      sync();
      await deliver(
        threadId,
        question.text,
        question.id,
        target.role === "assistant",
      );
    },
    [deliver, sync],
  );

  /** Sends every message that failed only because the connection was down. */
  const flush = useCallback(async () => {
    for (const item of outboxRef.current) {
      if (item.state === "failed" && item.error?.kind === "network") {
        await retry(item.id, false);
      }
    }
  }, [retry]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // The browser knows before the socket does: reconnect right away instead of
  // waiting out the backoff.
  useEffect(() => {
    const onOnline = () => {
      const threadId = threadRef.current;
      if (!threadId) return;
      if (!wsRef.current || wsRef.current.readyState > 1) {
        if (timerRef.current) clearTimeout(timerRef.current);
        attemptsRef.current = 0;
        void connect(threadId);
      }
      void flushRef.current();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [connect]);

  /** One decision per paused action, then the run continues on its own. */
  const decide = useCallback(
    async (type: "approve" | "reject") => {
      const threadId = threadRef.current;
      const pending = streamRef.current.approval;
      if (!threadId || !pending) return;
      try {
        await resumeRun(
          pending.runId,
          threadId,
          pending.actions.map(() => ({ type })),
        );
        streamRef.current = {
          ...streamRef.current,
          run: "running",
          approval: null,
        };
        sync();
      } catch (e) {
        setError(toInfo(e));
      }
    },
    [sync],
  );

  const dismissError = useCallback(() => setError(null), []);
  const approve = useCallback(() => decide("approve"), [decide]);
  const reject = useCallback(() => decide("reject"), [decide]);

  /** Catalog comes from GET /api/v1/models; PromptBar shows exactly this list. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listModels();
        if (cancelled) return;
        setModels(res.models);
        const initial =
          res.models.find((m) => m.id === res.defaultModel) ?? res.models[0];
        if (initial) {
          modelIdRef.current = initial.id;
          setModelId(initial.id);
        }
      } catch {
        // A missing catalog must not block chatting: the server falls back to
        // its own default model when modelId is omitted.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseModel = useCallback((id: string, effort?: string) => {
    modelIdRef.current = id;
    setModelId(id);
    // A model change invalidates the previous effort level.
    reasoningEffortRef.current = effort;
  }, []);

  const chooseReasoningEffort = useCallback((effort: string) => {
    reasoningEffortRef.current = effort;
  }, []);

  return {
    messages,
    isLoading,
    run,
    approval: approval as { runId: string; actions: ApprovalAction[] } | null,
    connection,
    error,
    models,
    modelId,
    chooseModel,
    chooseReasoningEffort,
    send,
    retry,
    dismissError,
    approve,
    reject,
  };
}
