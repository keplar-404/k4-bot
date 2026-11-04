import type { SubagentStatus } from "@backend/modules/agent/parts";
import type { ChatMessageView, MessagePart, RunState } from "../protocol";

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

/** The context meter: tokens of the latest model call, and today's tokens against the daily budget. */
export interface ChatUsage {
  contextTokens: number;
  /** Input tokens of the latest call read from the provider's prompt cache (0 when it does not cache). */
  cachedTokens?: number;
  todayUsed: number;
  todayLimit: number;
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
  usage: ChatUsage | null;
}

export type StreamEffect = "none" | "resync";

export function initialStreamState(
  messages: ChatMessageView[] = [],
  cursor = 0,
  usage: ChatUsage | null = null,
): StreamState {
  return {
    cursor,
    run: "idle",
    messages,
    draftId: null,
    approval: null,
    prompt: null,
    sleeping: null,
    usage,
  };
}

/** The assistant message of a run has a fixed id, the same one the server stores it under. */
export const assistantId = (runId: string) => `${runId || "run"}:assistant`;

/** Cleared whenever the run is going again (nothing being waited for). */
export const going = { approval: null, prompt: null, sleeping: null } as const;

// Re-export the SubagentStatus type for reduce-tool consumers.
export type { SubagentStatus };
