import type { MessagePart } from "../protocol";
import { request } from "./http";

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

export function createThread(
  botId: string,
  mode?: "allow_all" | "plan" | "ask",
): Promise<{ thread: ThreadRow }> {
  return request("/api/v1/chat/threads", {
    method: "POST",
    body: JSON.stringify({ botId, mode }),
  });
}

export function listThreads(botId: string): Promise<{ threads: ThreadRow[] }> {
  return request(
    `/api/v1/chat/threads?botId=${encodeURIComponent(botId)}&limit=1`,
  );
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
  usage?: { contextTokens: number; todayUsed: number; todayLimit: number };
  mode?: string;
}> {
  return request(`/api/v1/chat/threads/${threadId}/messages?limit=${limit}`);
}
