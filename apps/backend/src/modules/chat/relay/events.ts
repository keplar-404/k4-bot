import type { neon } from "@neondatabase/serverless";

export type Sql = ReturnType<typeof neon>;

export interface RelayEvent {
  seq: number;
  type: string;
  payload: unknown;
  ts: number;
}

/** Most events replayed to a reconnecting socket before it must reload history. */
export const RESUME_LIMIT = 500;

/** The thread's last assigned seq (0 for a new thread). */
export async function maxSeq(sql: Sql, threadId: string): Promise<number> {
  const [row] = (await sql`
    SELECT COALESCE(MAX(seq), 0) AS max_seq FROM chat_event WHERE thread_id = ${threadId}
  `) as Array<{ max_seq: number }>;
  return Number(row?.max_seq ?? 0);
}

/** Up to RESUME_LIMIT + 1 events after `cursor`, oldest first (one more than the limit tells "too far behind"). */
export async function eventsAfter(sql: Sql, threadId: string, cursor: number): Promise<RelayEvent[]> {
  const rows = (await sql`
    SELECT seq, type, payload, created_at FROM chat_event
    WHERE thread_id = ${threadId} AND seq > ${cursor}
    ORDER BY seq ASC LIMIT ${RESUME_LIMIT + 1}
  `) as Array<{ seq: number; type: string; payload: unknown; created_at: string }>;
  return rows.map((r) => ({ seq: Number(r.seq), type: r.type, payload: r.payload, ts: new Date(r.created_at).getTime() }));
}

export async function insertEvent(sql: Sql, threadId: string, event: RelayEvent): Promise<void> {
  await sql`
    INSERT INTO chat_event (thread_id, seq, type, payload)
    VALUES (${threadId}, ${event.seq}, ${event.type}, ${JSON.stringify(event.payload)}::jsonb)
    ON CONFLICT (thread_id, seq) DO NOTHING
  `;
}
