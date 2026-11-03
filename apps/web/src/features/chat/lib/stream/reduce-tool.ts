import type { SubagentStatus } from "@backend/modules/agent/parts";
import type { FileRef, MessagePart } from "../protocol";
import { editDraft, mergeToolParts } from "./drafts";
import type { StreamState } from "./types";
import { going } from "./types";

function payloadOf(event: { payload: unknown }): Record<string, unknown> {
  return event.payload && typeof event.payload === "object"
    ? (event.payload as Record<string, unknown>)
    : {};
}

export function handleToolStart(
  state: StreamState,
  runId: string,
  payload: Record<string, unknown>,
): StreamState {
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
  return {
    ...editDraft(state, runId, (parts) => mergeToolParts([...parts, part])),
    run: "running",
    ...going,
  };
}

export function handleToolProgress(
  state: StreamState,
  runId: string,
  payload: Record<string, unknown>,
): StreamState {
  const id = String(payload.id ?? "");
  const agents = Array.isArray(payload.agents)
    ? (payload.agents as SubagentStatus[])
    : undefined;
  return editDraft(state, runId, (parts) =>
    parts.map((p) => (p.type === "tool" && p.id === id ? { ...p, agents } : p)),
  );
}

export function handleToolEnd(
  state: StreamState,
  runId: string,
  payload: Record<string, unknown>,
): StreamState {
  const id = String(payload.id ?? "");
  const status = payload.status === "error" ? "error" : "done";
  return editDraft(state, runId, (parts) =>
    parts.map((p) =>
      p.type === "tool" && p.id === id
        ? {
            ...p,
            status,
            output:
              typeof payload.output === "string" ? payload.output : p.output,
            ...(Array.isArray(payload.files)
              ? { files: payload.files as FileRef[] }
              : {}),
            // The final sub-agent statuses (also saved in the message, so a reload shows them too).
            ...(Array.isArray(payload.agents)
              ? { agents: payload.agents as SubagentStatus[] }
              : {}),
          }
        : p,
    ),
  );
}
