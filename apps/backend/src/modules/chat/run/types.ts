export interface ChatRunParams {
  runId: string;
  threadId: string;
  userId: string;
  userMessageId: string;
  content: string;
  /** Files the user attached (uploaded beforehand with POST /files). */
  fileIds?: string[];
  modelId?: string;
  reasoningEffort?: string;
  /** The user ran /compact: summarize the conversation before answering. */
  compact?: boolean;
}

/** What the user (or the clock) must supply before the run can go on, or how it ended. */
export type SliceResult =
  | { status: "done" | "failed" | "continue" }
  | { status: "needs_input"; kind: "approval" | "answer" }
  | { status: "sleep"; ms: number };

/** The payload of the `user-input` event sent by POST /chat/runs/:id/resume. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export interface UserInput {
  decisions?: Json[];
  answer?: string;
}

/** A slice stops itself well inside the 30 minute guidance for a Workflow step and carries on in the next one. */
export const SLICE_WALL_MS = 20 * 60_000;
export const MAX_SLEEP_MS = 7 * 24 * 60 * 60_000;

/** Publishes one event of this run to the thread's live stream. */
export type Publish = (type: string, payload: object) => Promise<void>;
