import type { WorkflowGraph } from "@backend/modules/workflows/graph/schema";
import type { GraphIssue } from "@backend/modules/workflows/graph/validate";

export type { LiveEvent } from "@backend/modules/workflows/live/events";

export type WorkflowStatus = "draft" | "active" | "paused";
export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WorkflowStats = {
  runs: number;
  runs7d: number;
  succeeded7d: number;
  failed7d: number;
  lastStatus: RunStatus | null;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  graph: WorkflowGraph;
  publishedVersion: number;
  triggerKind: string | null;
  hasWebhook: boolean;
  nextRunAt: string | null;
  /** Set when the system turned it off (an app connection expired, it kept starting itself). */
  pausedReason: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
  issues: GraphIssue[];
};

export type WorkflowListItem = Workflow & { stats: WorkflowStats | null };
export type DailyRuns = {
  day: string;
  succeeded: number;
  failed: number;
  total: number;
};

export type RunStepStatus =
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "skipped"
  | "waiting";
export type RunSummary = {
  id: string;
  trigger: string;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  failedNodeId: string | null;
  error: string | null;
};
export type RunStep = {
  nodeId: string;
  nodeKind: string;
  status: RunStepStatus;
  attempt: number;
  input?: unknown;
  output?: unknown;
  error?: string | null;
};
/** `input`: what the trigger handed the run (a webhook's { body }, an app event's { data }, a form's { inputs }). */
export type RunDetail = RunSummary & { steps: RunStep[]; input?: unknown };
