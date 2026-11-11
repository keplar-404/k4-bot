import { redirectToSignIn } from "@/features/auth/auth-redirect";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { BASE } from "@/features/files/api/library";

export type AssistantTodo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};
export type RunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled";
export type AssistantRun = {
  id: string;
  threadId: string;
  workflowId: string;
  status: RunStatus;
  todos: AssistantTodo[];
  /** The turn so far (reasoning, tool calls, text): the same parts the chat page renders. */
  parts: MessagePart[];
  question: {
    kind?: string;
    action?: string;
    question?: string;
    apps?: Array<{ toolkit: string; name: string; logo: string | null }>;
  } | null;
  error: string | null;
};
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files: Array<{ id: string; name: string; mimeType: string }>;
  todos: AssistantTodo[];
  parts: MessagePart[];
  runId: string | null;
  createdAt: string;
};
export type ThreadSummary = {
  id: string;
  title: string;
  workflowId: string | null;
  workflowName: string | null;
  updatedAt: string;
};
export type Thread = {
  id: string;
  title: string;
  workflowId: string | null;
  modelId: string | null;
};

export const isWorking = (s: RunStatus | undefined) =>
  s === "queued" || s === "running" || s === "waiting";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/assistant${path}`, {
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
  if (res.status === 429 && !body?.message)
    throw new Error("Too many messages. Wait a minute and try again.");
  if (!res.ok) throw new Error(body?.message ?? "Something went wrong.");
  return body as T;
}

export const listThreads = (before?: string) =>
  request<{ items: ThreadSummary[] }>(
    `/threads${before ? `?before=${encodeURIComponent(before)}` : ""}`,
  );
export const createThread = (workflowId?: string) =>
  request<Thread>("/threads", {
    method: "POST",
    body: JSON.stringify({ workflowId }),
  });
export const getThread = (id: string) =>
  request<{
    thread: Thread;
    messages: AssistantMessage[];
    run: AssistantRun | null;
  }>(`/threads/${id}`);
export const renameThread = (id: string, title: string) =>
  request(`/threads/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
export const deleteThread = (id: string) =>
  request(`/threads/${id}`, { method: "DELETE" });
export const sendMessage = (
  threadId: string,
  body: {
    content: string;
    workflowId: string;
    modelId?: string;
    fileIds: string[];
    files: Array<{ id: string; name: string; mimeType: string }>;
  },
) =>
  request<{ runId: string }>(`/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const answerRun = (runId: string, approved: boolean) =>
  request(`/runs/${runId}/answer`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
export const stopRun = (runId: string) =>
  request(`/runs/${runId}/stop`, { method: "POST" });
