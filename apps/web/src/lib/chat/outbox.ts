import type { ChatErrorInfo } from "./protocol";

/**
 * The send queue.
 *
 * Every send is written here before the network call, so a reload, a crash or
 * a dropped connection cannot lose a message the user already typed. Pure
 * functions over an array: persistence lives in the hook, not here.
 */
export interface OutboxItem {
  id: string;
  threadId: string;
  content: string;
  createdAt: number;
  attempts: number;
  state: "queued" | "sending" | "failed";
  error?: ChatErrorInfo;
}

export const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;

/** Idempotent: enqueueing the same id twice keeps one entry. */
export function enqueue(items: OutboxItem[], item: OutboxItem): OutboxItem[] {
  if (items.some((i) => i.id === item.id)) return items;
  return [...items, item];
}

export function markSending(items: OutboxItem[], id: string): OutboxItem[] {
  return items.map((i) => (i.id === id ? { ...i, state: "sending" } : i));
}

export function markSent(items: OutboxItem[], id: string): OutboxItem[] {
  return items.filter((i) => i.id !== id);
}

export function markFailed(
  items: OutboxItem[],
  id: string,
  error: ChatErrorInfo,
): OutboxItem[] {
  return items.map((i) =>
    i.id === id
      ? { ...i, state: "failed", attempts: i.attempts + 1, error }
      : i,
  );
}

/** Manual retry: clears the error and puts the item back at the head of the queue. */
export function requeue(items: OutboxItem[], id: string): OutboxItem[] {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const rest = items.filter((i) => i.id !== id);
  return [{ ...target, state: "queued", error: undefined }, ...rest];
}

export function due(items: OutboxItem[]): OutboxItem[] {
  return items.filter((i) => i.state === "queued");
}

export function failed(items: OutboxItem[]): OutboxItem[] {
  return items.filter((i) => i.state === "failed");
}

/** Exponential backoff, deterministic so the check can assert exact values. */
export function backoffMs(attempts: number): number {
  const n = Math.max(0, attempts);
  return Math.min(BASE_BACKOFF_MS * 2 ** n, MAX_BACKOFF_MS);
}

export function canRetry(item: OutboxItem): boolean {
  if (item.attempts >= MAX_ATTEMPTS) return false;
  if (item.error && !item.error.retryable) return false;
  return true;
}
