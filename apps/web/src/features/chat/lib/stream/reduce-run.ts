import { ensureDraft } from "./drafts";
import { friendlyProviderError, reasonMessage } from "./provider-error";
import type { StreamState } from "./types";
import { going } from "./types";

export function handleRunEvent(
  state: StreamState,
  runId: string,
  type: string,
  payload: Record<string, unknown>,
): StreamState {
  switch (type) {
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
