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
        const ev = frame.event;
        const payload = (
          ev.payload && typeof ev.payload === "object" ? ev.payload : {}
        ) as Record<string, unknown>;
        // Mode changes are thread-level, not part of the stream state, but they still own a
        // sequence number: the cursor must advance or the next event looks like a gap and
        // forces a full history resync.
        if (ev.type === "thread.mode" && typeof payload.mode === "string") {
          ctx.setMode(payload.mode as "allow_all" | "plan" | "ask");
          const current = ctx.streamRef.current;
          if (ev.seq === current.cursor + 1) {
            ctx.streamRef.current = { ...current, cursor: ev.seq };
          } else if (ev.seq > current.cursor + 1) {
            void ctx.reload();
          }
          return;
        }
        const result = reduceEvent(ctx.streamRef.current, ev);
        // Only a new event (not a replay the reducer skipped) shows its notice.
        if (result.state !== ctx.streamRef.current) notifyFor(ev);
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
      // Signed out, no access, or the chat is gone: not a network problem. The error toast says what happened.
      ctx.setConnection("idle");
      return;
    }
    ctx.setConnection(info.kind === "network" ? "offline" : "reconnecting");
    scheduleRetry();
  }
}
