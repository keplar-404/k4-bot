"use client";

import { useEffect, useRef, useState } from "react";
import { openEditor, socketUrl } from "./api";

/** What the sandbox tells an open editor. */
export type SandboxEvent =
  | { type: "status"; state: string }
  | { type: "file.changed"; path: string; by: "bot" | "user"; at: number }
  | {
      type: "exec";
      command: string;
      exitCode: number;
      output: string;
      at: number;
    };

/**
 * The editor's live connection: opening it wakes the sandbox (and keeps it awake while connected). Reconnects with
 * backoff, minting a fresh token each time. `onEvent` is read through a ref, so a new callback never reconnects.
 */
export function useSandboxSocket(
  botId: string,
  onEvent: (e: SandboxEvent) => void,
) {
  const [state, setState] = useState<"connecting" | "open" | "error">(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    let closed = false;

    const connect = async () => {
      setState("connecting");
      try {
        const { token, userId } = await openEditor(botId);
        if (closed) return;
        ws = new WebSocket(socketUrl(botId, token, userId));
        ws.onopen = () => {
          tries = 0;
          setError(null);
          setState("open");
        };
        ws.onmessage = (m) => {
          try {
            handler.current(JSON.parse(String(m.data)) as SandboxEvent);
          } catch {
            // not one of ours: ignore
          }
        };
        ws.onclose = () => !closed && retry();
      } catch (e) {
        setError((e as Error).message);
        setState("error");
        if (!closed) retry();
      }
    };
    const retry = () => {
      tries += 1;
      timer = setTimeout(
        () => void connect(),
        Math.min(30_000, 1000 * 2 ** tries),
      );
    };

    void connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [botId]);

  return { state, error };
}
