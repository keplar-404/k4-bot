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
  authorBotId?: string | null;
  seq: number;
  createdAt: string;
}

/** A group chat (`groupId`) belongs to the group; the server picks its lead as the thread's bot. */
export function createThread(
  botId: string,
  mode?: "allow_all" | "plan" | "ask",
  groupId?: string,
): Promise<{ thread: ThreadRow }> {
  return request("/api/v1/chat/threads", {
    method: "POST",
    body: JSON.stringify(groupId ? { groupId, mode } : { botId, mode }),
  });
}

/** Continue a run that stopped: the server resumes the checkpoint without a new user message. */
export function continueRun(threadId: string): Promise<{ runId: string }> {
  return request(`/api/v1/chat/threads/${threadId}/resume`, { method: "POST" });
}

/** The latest chat of a bot (its own, not its group chats), or of a group. */
export function listThreads(
  botId: string,
  groupId?: string,
): Promise<{ threads: ThreadRow[] }> {
  const by = groupId
    ? `groupId=${encodeURIComponent(groupId)}`
    : `botId=${encodeURIComponent(botId)}`;
  return request(`/api/v1/chat/threads?${by}&limit=1`);
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
