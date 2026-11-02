"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatHttpError } from "@/lib/chat/client";
import { backoffMs } from "@/lib/chat/outbox";
import {
  type ActivityEvent,
  type ComputerStatus,
  getStatus,
  keepControl,
  mintSocketToken,
  pause,
  releaseControl,
  socketUrl,
  takeControl,
  wake,
} from "@/lib/computer/client";

/** How often the page tells the server the user still holds the mouse (the server lets go after 45s of silence). */
const KEEP_CONTROL_MS = 15_000;
const MAX_ACTIVITY = 50;

/**
 * The user's computer: status and activity over one WebSocket to the user's
 * Durable Object, plus the few actions the user can take. Nothing here starts
 * the computer by itself; only `wake()` does.
 */
export function useComputer() {
  const [status, setStatus] = useState<ComputerStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      try {
        const { userId, token } = await mintSocketToken();
        if (closed) return;
        ws = new WebSocket(socketUrl({ userId, token }));
        ws.onopen = () => {
          attempts.current = 0;
        };
        ws.onmessage = (event) => {
          try {
            const frame = JSON.parse(String(event.data));
            if (frame.type === "status") setStatus(frame.status);
            else if (frame.type === "activity")
              setActivity((a) => [
                ...a.slice(-(MAX_ACTIVITY - 1)),
                frame.event,
              ]);
            else if (frame.type === "activity-batch") setActivity(frame.events);
          } catch {
            // ignore a malformed frame
          }
        };
        ws.onclose = () => {
          if (!closed)
            timer = setTimeout(
              () => void connect(),
              backoffMs(attempts.current++),
            );
        };
        ws.onerror = () => ws?.close();
      } catch (e) {
        // A signed-out or forbidden user will not get better by retrying.
        if (
          e instanceof ChatHttpError &&
          ["auth", "forbidden"].includes(e.info.kind)
        )
          return;
        if (!closed)
          timer = setTimeout(
            () => void connect(),
            backoffMs(attempts.current++),
          );
      }
    };

    void getStatus()
      .then((s) => !closed && setStatus(s))
      .catch(() => undefined);
    void connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof ChatHttpError ? e.info.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const inControl = status?.lease?.kind === "user";

  // While the user holds the mouse, say so regularly; a closed tab then hands control back by itself.
  useEffect(() => {
    if (!inControl) return;
    const id = setInterval(
      () => void keepControl().catch(() => undefined),
      KEEP_CONTROL_MS,
    );
    return () => clearInterval(id);
  }, [inControl]);

  return {
    status,
    activity,
    busy,
    error,
    inControl,
    wake: () => run(async () => setStatus(await wake())),
    pause: () => run(async () => setStatus(await pause())),
    takeControl: () =>
      run(async () => {
        const result = await takeControl();
        if (!result.ok) setError(result.message ?? "Could not take control.");
      }),
    releaseControl: () => run(releaseControl),
  };
}
