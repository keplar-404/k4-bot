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
  snapshotUrl,
  socketUrl,
  takeControl,
  wake,
  wrapUp,
} from "@/lib/computer/client";

/** How often the page tells the server the user still holds the mouse (the server lets go after 5 min of silence). */
const KEEP_CONTROL_MS = 15_000;
const MAX_ACTIVITY = 50;

/**
 * The user's computer: status and activity over one WebSocket to the user's
 * Durable Object, plus the few actions the user can take. Nothing here starts
 * the computer by itself; only `wake()` does. Used once per page through
 * `ComputerProvider`, so the panel and the chat share one connection.
 */
export function useComputer() {
  const [status, setStatus] = useState<ComputerStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  /** The action in flight, so its button can show a spinner while the others are disabled. */
  const [pending, setPending] = useState<ComputerAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Local clock time the session ends, from the server's "ms left" (immune to clock skew). */
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const attempts = useRef(0);

  const applyStatus = useCallback((s: ComputerStatus) => {
    setStatus(s);
    setSessionEndsAt(s.session ? Date.now() + s.session.endsInMs : null);
  }, []);

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
            if (frame.type === "status") applyStatus(frame.status);
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
      .then((s) => !closed && applyStatus(s))
      .catch(() => undefined);
    void connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [applyStatus]);

  // The saved screen is fetched once per save (its time is in the URL, so the browser caches it).
  const snapshotAt = status?.snapshotAt;
  useEffect(() => {
    if (!snapshotAt) return;
    let url: string | null = null;
    let cancelled = false;
    void snapshotUrl(snapshotAt).then((u) => {
      if (cancelled && u) URL.revokeObjectURL(u);
      else {
        url = u;
        setSnapshot(u);
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshotAt]);

  const run = useCallback(
    async (name: ComputerAction, action: () => Promise<unknown>) => {
      setPending(name);
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(
          e instanceof ChatHttpError ? e.info.message : "Something went wrong.",
        );
      } finally {
        setPending(null);
      }
    },
    [],
  );

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
    busy: pending !== null,
    pending,
    error,
    inControl,
    sessionEndsAt,
    snapshot,
    wake: () =>
      run("wake", async () => {
        // Show "starting" at once; the server's own status replaces it within moments.
        setStatus((s) =>
          s ? { ...s, state: "starting", message: "Waking your computer…" } : s,
        );
        try {
          applyStatus(await wake());
        } catch (e) {
          // Do not leave the optimistic "starting" behind.
          void getStatus()
            .then(applyStatus)
            .catch(() => undefined);
          throw e;
        }
      }),
    pause: () => run("pause", async () => applyStatus(await pause())),
    wrapUp: () => run("wrap", async () => applyStatus(await wrapUp())),
    takeControl: () =>
      run("take", async () => {
        const result = await takeControl();
        if (!result.ok) setError(result.message ?? "Could not take control.");
      }),
    releaseControl: () => run("release", releaseControl),
  };
}

export type Computer = ReturnType<typeof useComputer>;
export type ComputerAction = "wake" | "pause" | "wrap" | "take" | "release";
