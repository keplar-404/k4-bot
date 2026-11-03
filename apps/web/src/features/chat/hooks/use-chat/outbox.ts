import type { OutboxItem } from "@/features/chat/lib/outbox";

export const outboxKey = (threadId: string) => `k4:outbox:${threadId}`;

export function readOutbox(threadId: string): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(outboxKey(threadId)) ?? "[]");
  } catch {
    return [];
  }
}

export function persistOutbox(threadId: string, items: OutboxItem[]): void {
  try {
    localStorage.setItem(outboxKey(threadId), JSON.stringify(items));
  } catch {
    // storage refused: the in-memory queue still works for this session
  }
}
