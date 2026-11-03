import { reduceEvent } from "./reduce-event";
import type { StreamState } from "./types";

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
