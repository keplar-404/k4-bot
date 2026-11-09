import { ensureDraft } from "./drafts";
import { friendlyProviderError, reasonMessage } from "./provider-error";
import type { Prompt, StreamState } from "./types";
import { going } from "./types";

export function handleRunEvent(
  state: StreamState,
  runId: string,
  type: string,
  payload: Record<string, unknown>,
): StreamState {
  switch (type) {
    // Group chats: the next bot took its turn (a new run the client did not start).
    case "run.started": {
      const next = ensureDraft({ ...state, draftId: null }, runId);
      const botId =
        typeof payload.botId === "string" ? payload.botId : undefined;
      return {
        ...next,
        run: "running",
        ...going,
        messages: next.messages.map((m) =>
          m.id === next.draftId && botId ? { ...m, botId } : m,
        ),
      };
    }
    case "run.resumed":
      return { ...state, run: "running", ...going };
    case "run.waiting_input":
      return {
        ...state,
        run: "waiting_input",
        prompt: {
          runId,
          kind: String(payload.kind ?? "info"),
          question: String(payload.question ?? "The bot needs your input."),
          ...optionalText(payload),
          ...(Array.isArray(payload.apps)
            ? { apps: payload.apps as NonNullable<Prompt["apps"]> }
            : {}),
        },
      };
    case "run.sleeping":
      return {
        ...state,
        run: "sleeping",
        sleeping: {
          until: Number(payload.until) || Date.now(),
          reason: String(payload.reason ?? ""),
        },
      };
    case "run.waiting_approval": {
      const actions = Array.isArray(payload.actions)
        ? (payload.actions as { name: string; args: Record<string, unknown> }[])
        : [];
      return {
        ...state,
        run: "waiting_approval",
        approval: { runId, actions },
      };
    }
    // Stopped by the user: like done, but a tool call still running ends as stopped.
    case "run.stopped":
    case "run.done": {
      // A repeated terminal event must not create a second assistant bubble.
      if (state.run === "done" && state.draftId === null) return state;
      const next = ensureDraft(state, runId);
      const draftId = next.draftId;
      return {
        ...next,
        run: "done",
        draftId: null,
        ...going,
        messages: next.messages.map((m) =>
          m.id === draftId
            ? {
                ...m,
                parts: m.parts?.map((p) =>
                  p.type === "tool" && p.status === "running"
                    ? { ...p, status: "error" as const }
                    : p,
                ),
                state: "sent",
              }
            : m,
        ),
      };
    }
    case "run.failed": {
      // Show a failed bubble even when the run died before emitting a token.
      const next = ensureDraft(state, runId);
      const failedId = next.draftId;
      const raw = typeof payload.error === "string" ? payload.error.trim() : "";
      const status =
        typeof payload.status === "number" ? payload.status : undefined;
      return {
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
                  // `notice`: the server wrote it for the user (daily budget, stopped by a reset): shown as is.
                  message: !raw
                    ? "The run stopped before finishing."
                    : payload.notice === true
                      ? raw
                      : (reasonMessage(payload.reason) ??
                        friendlyProviderError(raw, status)),
                  detail: raw || undefined,
                  retryable: true,
                },
              }
            : m,
        ),
      };
    }
    default:
      return state;
  }
}

/** The prompt's optional text fields (mode switch, secret form), only the ones the server sent. */
const PROMPT_TEXT = ["to", "reason", "plan", "name", "label", "why"] as const;
function optionalText(payload: Record<string, unknown>) {
  const fields: Partial<Record<(typeof PROMPT_TEXT)[number], string>> = {};
  for (const key of PROMPT_TEXT) {
    if (typeof payload[key] === "string") fields[key] = payload[key];
  }
  return fields;
}
