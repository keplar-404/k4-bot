"use client";

import { create } from "zustand";
import {
  type AssistantMessage,
  type AssistantRun,
  createThread,
  getThread,
  isWorking,
  type Thread,
} from "./api";

const THREAD_KEY = "workflow-assistant-thread";

const remember = (id: string | null) => {
  try {
    if (id) localStorage.setItem(THREAD_KEY, id);
    else localStorage.removeItem(THREAD_KEY);
  } catch {
    // Private window: the panel starts on a new chat next time.
  }
};
const remembered = () => {
  try {
    return localStorage.getItem(THREAD_KEY);
  } catch {
    return null;
  }
};

type State = {
  open: boolean;
  view: "chat" | "history";
  thread: Thread | null;
  messages: AssistantMessage[];
  run: AssistantRun | null;
  loading: boolean;
  error: string | null;
  setOpen: (open: boolean) => void;
  setView: (view: "chat" | "history") => void;
  /** Opens a chat (the remembered one, or a new one), with its messages and its latest run. */
  openThread: (id: string | null, workflowId?: string) => Promise<void>;
  newThread: (workflowId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** The turn so far, pushed while the assistant works (reasoning, tool calls, text). */
  applyParts: (p: {
    runId: string;
    threadId: string;
    parts: AssistantRun["parts"];
  }) => void;
  /** A progress event from the builder's live socket. */
  applyProgress: (p: {
    runId: string;
    threadId: string;
    status: AssistantRun["status"];
    todos: AssistantRun["todos"];
  }) => void;
};

/** The workflow assistant's chat panel: which chat is open and what its latest run is doing. */
export const useAssistant = create<State>((set, get) => ({
  open: false,
  view: "chat",
  thread: null,
  messages: [],
  run: null,
  loading: false,
  error: null,
  setOpen: (open) => set({ open }),
  setView: (view) => set({ view }),
  openThread: async (id, workflowId) => {
    const target = id ?? remembered();
    if (!target) return get().newThread(workflowId);
    set({ loading: true, error: null, view: "chat" });
    try {
      const r = await getThread(target);
      remember(r.thread.id);
      set({
        thread: r.thread,
        messages: r.messages,
        run: r.run,
        loading: false,
      });
    } catch {
      // A deleted or foreign chat: start fresh.
      remember(null);
      await get().newThread(workflowId);
    }
  },
  newThread: async (workflowId) => {
    set({ loading: true, error: null, view: "chat" });
    try {
      const t = await createThread(workflowId);
      remember(t.id);
      set({ thread: t, messages: [], run: null, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },
  refresh: async () => {
    const id = get().thread?.id;
    if (!id) return;
    try {
      const r = await getThread(id);
      if (get().thread?.id === id)
        set({ thread: r.thread, messages: r.messages, run: r.run });
    } catch {
      // The next event or poll tries again.
    }
  },
  applyParts: (p) => {
    const { thread, run } = get();
    if (thread?.id !== p.threadId) return;
    // A run the panel does not know yet (it just started): its row comes from the API.
    if (!run || run.id !== p.runId) return void get().refresh();
    set({ run: { ...run, parts: p.parts } });
  },
  applyProgress: (p) => {
    const { thread, run } = get();
    if (thread?.id !== p.threadId) return;
    set({
      run:
        run && run.id === p.runId
          ? { ...run, status: p.status, todos: p.todos }
          : run,
    });
    // A question to answer, a new run, or the end of the turn: the full state (answer, card) comes from the API.
    if (
      !run ||
      run.id !== p.runId ||
      !isWorking(p.status) ||
      p.status === "waiting"
    )
      void get().refresh();
  },
}));
