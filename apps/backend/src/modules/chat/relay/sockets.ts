import { eventsAfter, RESUME_LIMIT, type Sql } from "./events";

/** Sends one frame to every open socket of the thread. */
export function broadcast(sockets: WebSocket[], message: unknown) {
  const frame = JSON.stringify(message);
  for (const ws of sockets) {
    try {
      ws.send(frame);
    } catch (error) {
      console.error("[chat-relay] send failed", error);
    }
  }
}

/**
 * Replays everything after `cursor`, then `ready`. A missing cursor means
 * "start from now"; a gap larger than RESUME_LIMIT means "reload history".
 */
export async function replay(ws: WebSocket, sql: Sql, threadId: string, cursor: number, latest: number) {
  if (Number.isNaN(cursor)) {
    ws.send(JSON.stringify({ type: "ready", seq: latest }));
    return;
  }
  const events = await eventsAfter(sql, threadId, cursor);
  if (events.length > RESUME_LIMIT) {
    ws.send(JSON.stringify({ type: "resync" }));
    return;
  }
  for (const event of events) ws.send(JSON.stringify({ type: "event", event }));
  ws.send(JSON.stringify({ type: "ready", seq: latest }));
}
