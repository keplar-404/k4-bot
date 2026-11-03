import { redirectToSignIn } from "@/lib/auth-redirect";
import {
  type ChatErrorInfo,
  type MessagePart,
  mapHttpError,
  networkError,
} from "./protocol";

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
    // The session ended (expired or signed out elsewhere): sign in again, then come back here.
    if (res.status === 401) redirectToSignIn();
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
  parts: MessagePart[];
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
  name: string;
  free: boolean;
  vision: boolean;
  reasoning: boolean;
  reasoningEfforts: string[];
  tag: string;
}

type ModelCatalog = { models: ModelRow[]; defaultModel: string };
let catalog: Promise<ModelCatalog> | null = null;

/**
 * The model catalog, fetched once per page load and shared by every chat (it only changes with a
 * deploy; the server also lets the browser cache it). A failed fetch is not kept, so the next call retries.
 */
export function listModels(): Promise<ModelCatalog> {
  catalog ??= request<ModelCatalog>("/api/v1/models").catch((error) => {
    catalog = null;
    throw error;
  });
  return catalog;
}

/**
 * `lastSeq` is the stream cursor to resume live events from. `pending` is the
 * run's open question, approval or sleep (if any), which the live stream will
 * not replay because it happened before the cursor.
 */
export function getMessages(
  threadId: string,
  limit = 50,
): Promise<{
  messages: MessageRow[];
  hasMore: boolean;
  lastSeq: number;
  pending: { type: string; payload: unknown } | null;
}> {
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
  fileIds?: string[];
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

/** Answers a paused run: one decision per paused action, or the text answer to a question. */
export function resumeRun(
  runId: string,
  threadId: string,
  answer:
    | {
        decisions: Array<
          { type: "approve" } | { type: "reject"; message?: string }
        >;
      }
    | { answer: string },
): Promise<{ ok: boolean }> {
  return request(`/api/v1/chat/runs/${runId}/resume`, {
    method: "POST",
    body: JSON.stringify({ threadId, ...answer }),
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
