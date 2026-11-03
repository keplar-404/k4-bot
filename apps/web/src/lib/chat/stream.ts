import type { ChatMessageView, MessagePart, RunState } from "./protocol";

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

/** A question the agent asked (`ask_user`) and is waiting on, possibly for days. */
export interface Prompt {
  runId: string;
  kind: string;
  question: string;
}

export interface StreamState {
  cursor: number;
  run: RunState;
  messages: ChatMessageView[];
  /** id of the assistant message currently being streamed */
  draftId: string | null;
  /** Set while the run is paused for approval; one entry per paused action. */
  approval: { runId: string; actions: ApprovalAction[] } | null;
  prompt: Prompt | null;
  /** The agent chose to wait (`wait_for`); the run resumes by itself at `until`. */
  sleeping: { until: number; reason: string } | null;
}

export type StreamEffect = "none" | "resync";

export function initialStreamState(
  messages: ChatMessageView[] = [],
  cursor = 0,
): StreamState {
  return {
    cursor,
    run: "idle",
    messages,
    draftId: null,
    approval: null,
    prompt: null,
    sleeping: null,
  };
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

/** The assistant message of a run has a fixed id, the same one the server stores it under. */
export const assistantId = (runId: string) => `${runId || "run"}:assistant`;

/** One tool call can be stored twice (before and after an `ask_user` pause): keep the latest, in place. */
export function mergeToolParts(parts: MessagePart[]): MessagePart[] {
  const out: MessagePart[] = [];
  for (const part of parts) {
    const at =
      part.type === "tool"
        ? out.findIndex((p) => p.type === "tool" && p.id === part.id)
        : -1;
    if (at >= 0) out[at] = part;
    else out.push(part);
  }
  return out;
}

export const textOfParts = (parts: MessagePart[]): string =>
  parts.map((p) => (p.type === "text" ? p.text : "")).join("");

function ensureDraft(state: StreamState, runId: string): StreamState {
  if (state.draftId) return state;
  const id = assistantId(runId);
  // A reload in the middle of a run already holds the part of this message that was saved.
  if (state.messages.some((m) => m.id === id)) {
    return {
      ...state,
      draftId: id,
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, state: "sending" } : m,
      ),
    };
  }
  const draft: ChatMessageView = {
    id,
    role: "assistant",
    text: "",
    parts: [],
    state: "sending",
    createdAt: Date.now(),
  };
  return { ...state, draftId: id, messages: [...state.messages, draft] };
}

/** Applies `change` to the parts of the message being streamed and keeps `text` in step. */
function editDraft(
  state: StreamState,
  runId: string,
  change: (parts: MessagePart[]) => MessagePart[],
): StreamState {
  const next = ensureDraft(state, runId);
  return {
    ...next,
    messages: next.messages.map((m) => {
      if (m.id !== next.draftId) return m;
      const parts = change(m.parts ?? []);
      return { ...m, parts, text: textOfParts(parts) };
    }),
  };
}

/**
 * One model turn (everything after the last tool call) has at most one reasoning part, then one
 * text part: the shape the server stores. Some models stream reasoning and answer at the same
 * time, so their deltas arrive interleaved; each joins its own part of the turn instead of
 * opening a new block, and reasoning that arrives after the answer began still goes before it.
 */
export const appendDelta =
  (type: "text" | "reasoning", delta: string) =>
  (parts: MessagePart[]): MessagePart[] => {
    const turnStart = parts.findLastIndex((p) => p.type === "tool") + 1;
    const own = parts.findIndex((p, i) => i >= turnStart && p.type === type);
    if (own >= 0)
      return parts.map((p, i) =>
        i === own && p.type === type ? { type, text: p.text + delta } : p,
      );
    const part: MessagePart = { type, text: delta };
    const answer =
      type === "reasoning"
        ? parts.findIndex((p, i) => i >= turnStart && p.type === "text")
        : -1;
    return answer >= 0
      ? [...parts.slice(0, answer), part, ...parts.slice(answer)]
      : [...parts, part];
  };

/** The run is going again: nothing is being waited for. */
const going = { approval: null, prompt: null, sleeping: null } as const;

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
    case "agent.token":
    case "agent.reasoning": {
      const chunk = typeof payload.text === "string" ? payload.text : "";
      const type = event.type === "agent.token" ? "text" : "reasoning";
      next = {
        ...editDraft(next, runId, appendDelta(type, chunk)),
        run: "running",
        ...going,
      };
      break;
    }
    case "tool.start": {
      const part: MessagePart = {
        type: "tool",
        id: String(payload.id ?? ""),
        name: String(payload.name ?? "tool"),
        input:
          typeof payload.input === "string"
            ? payload.input
            : JSON.stringify(payload.input ?? ""),
        status: "running",
      };
      next = {
        ...editDraft(next, runId, (parts) => mergeToolParts([...parts, part])),
        run: "running",
        ...going,
      };
      break;
    }
    case "tool.end": {
      const id = String(payload.id ?? "");
      const status = payload.status === "error" ? "error" : "done";
      next = editDraft(next, runId, (parts) =>
        parts.map((p) =>
          p.type === "tool" && p.id === id
            ? {
                ...p,
                status,
                output:
                  typeof payload.output === "string"
                    ? payload.output
                    : p.output,
              }
            : p,
        ),
      );
      break;
    }
    case "run.resumed":
      next = { ...next, run: "running", ...going };
      break;
    case "run.waiting_input":
      next = {
        ...next,
        run: "waiting_input",
        prompt: {
          runId,
          kind: String(payload.kind ?? "info"),
          question: String(payload.question ?? "The bot needs your input."),
        },
      };
      break;
    case "run.sleeping":
      next = {
        ...next,
        run: "sleeping",
        sleeping: {
          until: Number(payload.until) || Date.now(),
          reason: String(payload.reason ?? ""),
        },
      };
      break;
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
      const draftId = next.draftId;
      next = {
        ...next,
        run: "done",
        draftId: null,
        ...going,
        messages: next.messages.map((m) =>
          m.id === draftId ? { ...m, state: "sent" } : m,
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
        ...going,
        messages: next.messages.map((m) =>
          m.id === failedId
            ? {
                ...m,
                parts: m.parts?.map((p) =>
                  p.type === "tool" && p.status === "running"
                    ? { ...p, status: "error" as const }
                    : p,
                ),
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
      // Unknown events still advance the cursor, so replay stays correct.
      break;
  }

  return { state: next, effect: "none" };
}

/**
 * Seeds the state from the run's open question/approval/sleep reported with the history
 * (those events happened before the stream cursor, so the socket will not replay them).
 */
export function applyPending(
  state: StreamState,
  pending: { type: string; payload: unknown } | null | undefined,
): StreamState {
  if (!pending) return state;
  const applied = reduceEvent(state, {
    seq: state.cursor + 1,
    type: pending.type,
    payload: pending.payload,
  }).state;
  return { ...applied, cursor: state.cursor };
}
