// Plain literals (not derived from the Drizzle schema): the web app imports these types too.
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type StepStatus = "running" | "retrying" | "succeeded" | "failed" | "skipped" | "waiting";

/**
 * What an open builder hears while a run goes. Step input and output are never sent: they can hold private data
 * and be large, so the builder fetches them from GET /workflows/runs/:runId when it shows a run.
 */
export type LiveEvent =
  | { type: "run.started"; runId: string; at: string }
  | {
      type: "step";
      runId: string;
      nodeId: string;
      nodeKind: string;
      status: StepStatus;
      attempt: number;
      error?: string;
      resumeAt?: string;
      at: string;
    }
  | { type: "run.finished"; runId: string; status: RunStatus; failedNodeId?: string; error?: string; at: string }
  /** The workflow assistant saved the draft: open builders reload it (the graph itself is not sent). */
  | { type: "draft.updated"; at: string }
  /** The assistant started or stopped working on this workflow (the canvas is read-only meanwhile). */
  | { type: "assistant.lock"; runId: string; locked: boolean; at: string }
  /** The assistant's turn so far (reasoning, tool calls, text), pushed as it grows: the chat panel shows it live. */
  | { type: "assistant.parts"; runId: string; threadId: string; parts: unknown[]; at: string }
  /** The assistant's progress for an open chat panel: its to-do list, a question, or the end of its turn. */
  | {
      type: "assistant.progress";
      runId: string;
      threadId: string;
      status: AssistantRunStatus;
      todos: Array<{ content: string; status: "pending" | "in_progress" | "completed" }>;
      at: string;
    };

export type AssistantRunStatus = "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
