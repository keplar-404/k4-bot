import { handleRunEvent } from "./reduce-run";
import { handleToken } from "./reduce-token";
import {
  handleToolEnd,
  handleToolProgress,
  handleToolStart,
} from "./reduce-tool";
import type { ChatUsage, StreamEffect, StreamState, WireEvent } from "./types";

function payloadOf(event: WireEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === "object"
    ? (event.payload as Record<string, unknown>)
    : {};
}

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
      next = handleToken(
        next,
        runId,
        payload,
        event.type === "agent.reasoning",
      );
      break;
    }
    case "tool.start":
      next = handleToolStart(next, runId, payload);
      break;
    case "tool.progress":
      next = handleToolProgress(next, runId, payload);
      break;
    case "context.usage":
      next = { ...next, usage: payload as unknown as ChatUsage };
      break;
    case "tool.end":
      next = handleToolEnd(next, runId, payload);
      break;
    case "run.retrying":
      // The model call failed and was never saved, but its text already streamed in. The run goes on from its
      // last saved step, so the chat reloads what was saved (dropping that text) and keeps streaming from here.
      return { state: { ...next, run: "running" }, effect: "resync" };
    case "run.resumed":
    case "run.waiting_input":
    case "run.sleeping":
    case "run.waiting_approval":
    case "run.done":
    case "run.stopped":
    case "run.failed":
      next = handleRunEvent(next, runId, event.type, payload);
      break;
    default:
      // Unknown events still advance the cursor, so replay stays correct.
      break;
  }

  return { state: next, effect: "none" };
}
