import { appendDelta, editDraft } from "./drafts";
import type { StreamState, WireEvent } from "./types";
import { going } from "./types";

export function handleToken(
  state: StreamState,
  runId: string,
  payload: Record<string, unknown>,
  isReasoning: boolean,
): StreamState {
  const chunk = typeof payload.text === "string" ? payload.text : "";
  const type = isReasoning ? "reasoning" : "text";
  return {
    ...editDraft(state, runId, appendDelta(type, chunk)),
    run: "running",
    ...going,
  };
}
