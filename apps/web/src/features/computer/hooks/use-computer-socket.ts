"use client";

import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { ChatHttpError } from "@/features/chat/lib/client";
import { backoffMs } from "@/features/chat/lib/outbox";
import {
  type ActivityEvent,
  type ComputerStatus,
  getStatus,
  mintSocketToken,
  socketUrl,
} from "@/features/computer/api";

const MAX_ACTIVITY = 50;

/** Status and activity over one WebSocket to the user's Durable Object, reconnecting with backoff. */
export function useComputerSocket(
  applyStatus: (s: ComputerStatus) => void,
  setActivity: Dispatch<SetStateAction<ActivityEvent[]>>,
) {
  const attempts = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
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
}
