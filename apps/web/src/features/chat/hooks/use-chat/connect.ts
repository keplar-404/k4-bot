import { mintToken, wsUrl } from "@/features/chat/lib/client";
import { backoffMs } from "@/features/chat/lib/outbox";
import { reduceEvent, type WireEvent } from "@/features/chat/lib/stream";

import { notifyFor } from "./notices";
import type { ChatCtx } from "./types";
export async function connectImpl(
  ctx: ChatCtx,
  threadId: string,
): Promise<void> {
  if (ctx.closedRef.current) return;
  ctx.setConnection(
    ctx.attemptsRef.current > 0 ? "reconnecting" : "connecting",
  );

  const scheduleRetry = () => {
    ctx.timerRef.current = setTimeout(
      () => void connectImpl(ctx, threadId),
      backoffMs(ctx.attemptsRef.current++),
    );
  };

  try {
    const { token, userId } = await mintToken(threadId);
    if (ctx.closedRef.current) return;
    const ws = new WebSocket(
      wsUrl({ threadId, userId, token, lastSeq: ctx.streamRef.current.cursor }),
    );
    ctx.wsRef.current = ws;

    ws.onopen = () => {
      ctx.attemptsRef.current = 0;
      ctx.setConnection("open");
      void ctx.flushRef.current();
    };
    ws.onmessage = (event: MessageEvent) => {
      let frame: { type?: string; event?: WireEvent };
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (frame.type === "resync") {
        void ctx.reload();
      } else if (frame.type === "event" && frame.event) {
        const result = reduceEvent(ctx.streamRef.current, frame.event);
        // Only a new event (not a replay the reducer skipped) shows its notice.
        if (result.state !== ctx.streamRef.current) notifyFor(frame.event);
        if (result.effect === "resync") {
          void ctx.reload();
          return;
        }
        ctx.streamRef.current = result.state;
        ctx.sync();
      }
    };
    ws.onclose = () => {
      if (ctx.closedRef.current) return;
      ctx.setConnection("reconnecting");
      scheduleRetry();
    };
    ws.onerror = () => ws.close();
  } catch (e) {
    const info = ctx.toInfo(e);
    ctx.setError(info);
    if (ctx.FATAL.has(info.kind)) {
      ctx.setConnection("offline");
      return;
    }
    ctx.setConnection(info.kind === "network" ? "offline" : "reconnecting");
    scheduleRetry();
  }
}
