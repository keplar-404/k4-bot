import type { WorkflowGraph } from "@backend/modules/workflows/graph/schema";
import type { GraphIssue } from "@backend/modules/workflows/graph/validate";
import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE } from "@/features/files/api/library";
import type {
  DailyRuns,
  RunDetail,
  RunSummary,
  Workflow,
  WorkflowListItem,
} from "./types";

export type { GraphIssue, WorkflowGraph };
export * from "./types";
/** A failed call, with the server's code and (for graph problems) the issues to highlight. */
export class WorkflowApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly issues: GraphIssue[] = [],
  ) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/workflows${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new WorkflowApiError("Connection lost. Try again.", "NETWORK", 0);
  }
  if (res.status === 401) redirectToSignIn();
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string; issues?: GraphIssue[] })
    | null;
  if (res.status === 429)
    throw new WorkflowApiError(
      "Too many requests. Wait a minute and try again.",
      "RATE_LIMITED",
      429,
    );
  if (!res.ok) {
    throw new WorkflowApiError(
      body?.message ?? "Something went wrong. Try again.",
      body?.error ?? "ERROR",
      res.status,
      body?.issues ?? [],
    );
  }
  return body as T;
}

export const listWorkflows = () =>
  request<{ items: WorkflowListItem[]; daily: DailyRuns[] }>("");
export const getWorkflow = (id: string) => request<Workflow>(`/${id}`);
export const createWorkflow = (name?: string) =>
  request<Workflow>("", { method: "POST", body: JSON.stringify({ name }) });
export const deleteWorkflow = (id: string) =>
  request<{ ok: true }>(`/${id}`, { method: "DELETE" });

export const saveWorkflow = (
  id: string,
  patch: { name?: string; graph?: WorkflowGraph; expectedUpdatedAt?: string },
) =>
  request<Workflow>(`/${id}`, { method: "PUT", body: JSON.stringify(patch) });

export const publishWorkflow = (id: string) =>
  request<Workflow & { webhookToken: string | null }>(`/${id}/publish`, {
    method: "POST",
  });
export const pauseWorkflow = (id: string) =>
  request<Workflow>(`/${id}/pause`, { method: "POST" });

export const runWorkflow = (
  id: string,
  body: { mode: "test" | "live"; input?: unknown },
) =>
  request<{ run: RunSummary }>(`/${id}/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const listRuns = (id: string) =>
  request<{ items: RunSummary[] }>(`/${id}/runs`);
export const getRun = (runId: string) => request<RunDetail>(`/runs/${runId}`);
export const cancelRun = (runId: string) =>
  request<{ ok: true }>(`/runs/${runId}/cancel`, { method: "POST" });
/** A short-lived token for the live socket (a WebSocket cannot carry the session to another origin). */
export const getLiveToken = (id: string) =>
  request<{ token: string; userId: string }>(`/${id}/live-token`, {
    method: "POST",
  });
export const liveSocketUrl = (
  id: string,
  auth: { token: string; userId: string },
) =>
  `${BASE.replace(/^http/, "ws")}/api/v1/workflows/${id}/live?${new URLSearchParams(auth)}`;

export const getSharedBots = (id: string) =>
  request<{ botIds: string[] }>(`/${id}/bots`);
export const setSharedBots = (id: string, botIds: string[]) =>
  request<{ botIds: string[] }>(`/${id}/bots`, {
    method: "PUT",
    body: JSON.stringify({ botIds }),
  });
