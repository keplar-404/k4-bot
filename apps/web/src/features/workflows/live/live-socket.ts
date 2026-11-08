"use client";

import { getLiveToken, type LiveEvent, liveSocketUrl } from "../api";

/** Waits between reconnect tries: 1 s, 2 s, 5 s, 10 s, then every 30 s. */
const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];
/** After this many failed tries in a row, the caller should poll instead. */
const FAILURES_BEFORE_POLLING = 3;
/** The server closes with this code when the workflow was deleted: nothing to reconnect to. */
const WORKFLOW_DELETED = 4404;

type Handlers = {
  onEvent: (event: LiveEvent) => void;
  /** Runs on every (re)connect: reload what may have been missed while the socket was down. */
  onOpen: () => void;
  /** True when the socket keeps failing (poll instead), false once it is back. */
  onDown: (down: boolean) => void;
};

/** Keeps one socket open to the workflow's live relay, reconnecting with backoff. Returns a function that closes it. */
export function connectLive(workflowId: string, handlers: Handlers) {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let closed = false;

  const retryLater = () => {
    if (closed) return;
    failures++;
    if (failures === FAILURES_BEFORE_POLLING) handlers.onDown(true);
    const wait = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)];
    timer = setTimeout(connect, wait);
  };

  async function connect() {
    if (closed) return;
    let ws: WebSocket;
    try {
      // A fresh token every time: they live five minutes.
      const auth = await getLiveToken(workflowId);
      if (closed) return;
      ws = new WebSocket(liveSocketUrl(workflowId, auth));
    } catch {
      retryLater();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      if (failures >= FAILURES_BEFORE_POLLING) handlers.onDown(false);
      failures = 0;
      handlers.onOpen();
    };
    ws.onmessage = (message) => {
      let event: LiveEvent;
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return;
      }
      handlers.onEvent(event);
    };
    // A failed connection fires onerror and then onclose; onclose alone decides what happens next.
    ws.onclose = (close) => {
      socket = null;
      if (close.code === WORKFLOW_DELETED) closed = true;
      retryLater();
    };
  }

  void connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    socket?.close(1000);
  };
}
