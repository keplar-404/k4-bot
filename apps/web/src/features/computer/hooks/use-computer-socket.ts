"use client";

import { useEffect, useRef } from "react";
import { ChatHttpError } from "@/features/chat/lib/client";
import { backoffMs } from "@/features/chat/lib/outbox";
import { getStatus, mintSocketToken, socketUrl } from "@/features/computer/api";
import { useComputerStore } from "@/features/computer/store";

/** Status and activity over one WebSocket to the user's Durable Object, written into the shared store; reconnects with backoff. */
export function useComputerSocket() {
  const attempts = useRef(0);
  useEffect(() => {
    const { applyStatus, pushActivity, setActivity } =
      useComputerStore.getState();
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
            else if (frame.type === "activity") pushActivity(frame.event);
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
  }, []);
}
