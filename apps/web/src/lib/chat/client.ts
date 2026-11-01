import { type ChatErrorInfo, mapHttpError, networkError } from "./protocol";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

export class ChatHttpError extends Error {
  readonly info: ChatErrorInfo;
  constructor(info: ChatErrorInfo) {
    super(info.message);
    this.name = "ChatHttpError";
    this.info = info;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ChatHttpError(networkError());
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ChatHttpError(
      mapHttpError(res.status, body, res.headers.get("retry-after")),
    );
  }
  return (await res.json()) as T;
}

export interface ThreadRow {
  id: string;
  botId: string;
  title: string;
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  role: string;
  parts: Array<{ type?: string; text?: string }>;
  runId: string | null;
  seq: number;
  createdAt: string;
}

export function createThread(botId: string): Promise<{ thread: ThreadRow }> {
  return request("/api/v1/chat/threads", {
    method: "POST",
    body: JSON.stringify({ botId }),
  });
}

export function listThreads(botId: string): Promise<{ threads: ThreadRow[] }> {
  return request(
    `/api/v1/chat/threads?botId=${encodeURIComponent(botId)}&limit=1`,
  );
}

export interface ModelRow {
  id: string;
  free: boolean;
  vision: boolean;
  reasoning: boolean;
  reasoningEfforts: string[];
  tag: string;
}

export function listModels(): Promise<{
  models: ModelRow[];
  defaultModel: string;
}> {
  return request("/api/v1/models");
}

/** `lastSeq` is the stream cursor to resume live events from. */
export function getMessages(
  threadId: string,
  limit = 50,
): Promise<{ messages: MessageRow[]; hasMore: boolean; lastSeq: number }> {
  return request(`/api/v1/chat/threads/${threadId}/messages?limit=${limit}`);
}

/**
 * `messageId` makes a resend idempotent: the server stores the message, and
 * starts its run, once. `retry` re-asks a message whose answer failed, which
 * does start a new run.
 */
export function sendMessage(args: {
  threadId: string;
  messageId: string;
  content: string;
  modelId?: string;
  reasoningEffort?: string;
  retry?: boolean;
}): Promise<{ runId: string; userMessageId: string }> {
  const { threadId, ...body } = args;
  return request(`/api/v1/chat/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function mintToken(
  threadId: string,
): Promise<{ token: string; userId: string }> {
  return request(`/api/v1/chat/threads/${threadId}/ws-token`, {
    method: "POST",
  });
}

/** One decision per paused action, in order. */
export function resumeRun(
  runId: string,
  threadId: string,
  decisions: Array<{ type: "approve" } | { type: "reject"; message?: string }>,
): Promise<{ ok: boolean }> {
  return request(`/api/v1/chat/runs/${runId}/resume`, {
    method: "POST",
    body: JSON.stringify({ threadId, decisions }),
  });
}

/** ws:// for the relay, with an optional cursor so a reconnect can replay. */
export function wsUrl(args: {
  threadId: string;
  userId: string;
  token: string;
  lastSeq?: number;
}): string {
  const base = BASE.replace(/^http/, "ws");
  const q = new URLSearchParams({ userId: args.userId, token: args.token });
  if (args.lastSeq !== undefined) q.set("lastSeq", String(args.lastSeq));
  return `${base}/api/v1/chat/threads/${args.threadId}/ws?${q.toString()}`;
}
