import { BASE, request } from "./http";

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
  /** /compact: summarize the conversation to free context. */
  compact?: boolean;
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
