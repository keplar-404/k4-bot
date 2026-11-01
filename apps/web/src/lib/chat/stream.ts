import type { ChatMessageView, RunState } from "./protocol";

/**
 * Event reducer for the thread stream.
 *
 * Three rules, each of which was a live bug class in the previous wiring:
 *  - duplicates are dropped (seq <= cursor), so a reconnect that replays the
 *    tail cannot double-post tokens;
 *  - a gap (seq > cursor + 1) is NOT applied: it asks the caller to reload
 *    history, because applying it would produce a conversation with a hole;
 *  - the reducer never assumes it has seen everything: the caller decides
 *    whether to reload, this file only reports the fact.
 */

export interface WireEvent {
  seq: number;
  type: string;
  payload: unknown;
}

/** One action the agent is waiting for the user to approve. */
export interface ApprovalAction {
  name: string;
  args: Record<string, unknown>;
}

export interface StreamState {
  cursor: number;
  run: RunState;
  messages: ChatMessageView[];
  /** id of the assistant message currently being streamed */
  draftId: string | null;
  /** Set while the run is paused for approval; one entry per paused action. */
  approval: { runId: string; actions: ApprovalAction[] } | null;
}

export type StreamEffect = "none" | "resync";

export function initialStreamState(
  messages: ChatMessageView[] = [],
  cursor = 0,
): StreamState {
  return { cursor, run: "idle", messages, draftId: null, approval: null };
}

/**
 * Provider errors are written for developers. Users get one plain sentence;
 * the raw text stays in the bubble tooltip for whoever is debugging.
 *
 * Classified by the provider's HTTP status, never by searching the text for
 * digits: "404" appears inside request ids and URLs, which used to turn
 * unrelated failures into "model no longer available".
 */
export function friendlyProviderError(raw: string, status?: number): string {
  // OpenAI-SDK style messages begin with the status ("429 Provider returned…").
  const code = status ?? (Number(/^\s*(\d{3})\b/.exec(raw)?.[1]) || undefined);
  const s = raw.toLowerCase();

  switch (code) {
    case 401:
      return "The model provider rejected the API key. Check OPENROUTER_API_KEY.";
    case 402:
      return "The model provider account is out of credit. Add credit or pick a free model.";
    case 403:
      return "That model isn't available to this app. Pick another one.";
    case 404:
      return "That model is no longer available. Pick another one.";
    case 408:
    case 504:
      return "The model took too long to respond. Try again.";
    case 429:
      // Neither carries a reset time, so never promise one.
      if (s.includes("free-models-per-day") || s.includes("daily limit")) {
        return "You've used today's free requests for this model. It resets at midnight UTC — or pick a paid model.";
      }
      if (s.includes("rate-limited upstream") || s.includes("shared_pool")) {
        return "This free model's shared pool is busy right now. Try again in a few seconds, or pick another model.";
      }
      return "That model is busy right now. Try again in a moment, or pick another model.";
  }
  if (code !== undefined && code >= 500) {
    return "The model provider had a problem. Try again, or pick another model.";
  }
  if (s.includes("context") && (s.includes("length") || s.includes("window"))) {
    return "This conversation is too long for that model. Start a new chat.";
  }
  if (s.includes("timeout") || s.includes("timed out")) {
    return "The model took too long to respond. Try again.";
  }
  return "The model didn't respond. Try again.";
}

function payloadOf(event: WireEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === "object"
    ? (event.payload as Record<string, unknown>)
    : {};
}

function ensureDraft(state: StreamState, runId: string): StreamState {
  if (state.draftId) return state;
  const id = `draft-${runId || "run"}`;
  const draft: ChatMessageView = {
    id,
    role: "assistant",
    text: "",
    state: "sending",
    createdAt: Date.now(),
  };
  return { ...state, draftId: id, messages: [...state.messages, draft] };
}

const textOf = (parts: unknown): string =>
  (Array.isArray(parts) ? parts : [])
    .map((p) =>
      p && typeof p === "object" && (p as { type?: string }).type === "text"
        ? String((p as { text?: unknown }).text ?? "")
        : "",
    )
    .join("");

export function reduceEvent(
  state: StreamState,
  event: WireEvent,
): { state: StreamState; effect: StreamEffect } {
  if (!Number.isFinite(event.seq) || event.seq <= state.cursor) {
    return { state, effect: "none" };
  }
  if (event.seq !== state.cursor + 1) {
    return { state, effect: "resync" };
  }

  const payload = payloadOf(event);
  const runId = typeof payload.runId === "string" ? payload.runId : "";
  let next: StreamState = { ...state, cursor: event.seq };

  switch (event.type) {
    case "agent.token": {
      next = ensureDraft(next, runId);
      const chunk = typeof payload.text === "string" ? payload.text : "";
      next = {
        ...next,
        run: "running",
        approval: null,
        messages: next.messages.map((m) =>
          m.id === next.draftId ? { ...m, text: m.text + chunk } : m,
        ),
      };
      break;
    }
    case "run.waiting_approval": {
      const actions = Array.isArray(payload.actions)
        ? (payload.actions as ApprovalAction[])
        : [];
      next = { ...next, run: "waiting_approval", approval: { runId, actions } };
      break;
    }
    case "run.done": {
      // A repeated terminal event must not create a second assistant bubble.
      if (state.run === "done" && state.draftId === null) break;
      next = ensureDraft(next, runId);
      const authoritative = textOf(payload.parts);
      const draftId = next.draftId;
      next = {
        ...next,
        run: "done",
        draftId: null,
        approval: null,
        messages: next.messages.map((m) =>
          m.id === draftId
            ? { ...m, state: "sent", text: authoritative || m.text }
            : m,
        ),
      };
      break;
    }
    case "run.failed": {
      // Show a failed bubble even when the run died before emitting a token.
      next = ensureDraft(next, runId);
      const failedId = next.draftId;
      const raw = typeof payload.error === "string" ? payload.error.trim() : "";
      const status =
        typeof payload.status === "number" ? payload.status : undefined;
      next = {
        ...next,
        run: "failed",
        draftId: null,
        approval: null,
        messages: next.messages.map((m) =>
          m.id === failedId
            ? {
                ...m,
                state: "failed",
                error: {
                  kind: "server",
                  message: raw
                    ? friendlyProviderError(raw, status)
                    : "The run stopped before finishing.",
                  detail: raw || undefined,
                  retryable: true,
                },
              }
            : m,
        ),
      };
      break;
    }
    default:
      // tool.call / tool.result: advance the cursor so replay stays correct,
      // but they do not change the transcript.
      break;
  }

  return { state: next, effect: "none" };
}
