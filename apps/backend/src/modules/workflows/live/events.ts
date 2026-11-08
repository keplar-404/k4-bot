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
  | { type: "run.finished"; runId: string; status: RunStatus; failedNodeId?: string; error?: string; at: string };
