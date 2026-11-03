import type { ChatMessageView, MessagePart } from "../protocol";
import type { StreamState } from "./types";
import { assistantId } from "./types";

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

export function ensureDraft(state: StreamState, runId: string): StreamState {
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
export function editDraft(
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
