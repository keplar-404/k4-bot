import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE } from "@/features/files/api/library";
import type { ScheduleConfig } from "@/features/schedules/describe";

export type Task = {
  id: string;
  botId: string;
  threadId: string | null;
  title: string;
  prompt: string;
  schedule: ScheduleConfig;
  status: "active" | "paused";
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  createdByBot: boolean;
};
export type TaskInput = {
  title: string;
  prompt: string;
  schedule: ScheduleConfig;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/tasks${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Connection lost. Try again.");
  }
  if (res.status === 401) redirectToSignIn();
  const body = (await res.json().catch(() => null)) as
    | (T & { message?: string })
    | null;
  if (res.status === 429)
    throw new Error("Too many requests. Wait a minute and try again.");
  if (!res.ok)
    throw new Error(body?.message ?? "Something went wrong. Try again.");
  return body as T;
}

export const listTasks = () =>
  request<{ items: Task[] }>("").then((r) => r.items);
export const createTask = (botId: string, input: TaskInput) =>
  request<{ task: Task }>("", {
    method: "POST",
    body: JSON.stringify({ botId, ...input }),
  }).then((r) => r.task);
export const updateTask = (
  id: string,
  patch: Partial<TaskInput> & { status?: Task["status"] },
) =>
  request<{ task: Task }>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.task);
export const deleteTask = (id: string) =>
  request<{ ok: true }>(`/${id}`, { method: "DELETE" });
export const runTaskNow = (id: string) =>
  request<{ threadId: string | null }>(`/${id}/run`, { method: "POST" });
