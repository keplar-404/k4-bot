import { useEffect } from "react";
import type { ChatCtx } from "./types";

export function useHydration(
  ctxRef: React.MutableRefObject<ChatCtx | null>,
  botId: string,
  groupId?: string,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  useEffect(() => {
    const ctx = ctxRef.current!;
    ctx.closedRef.current = false;
    let cancelled = false;
    ctx.threadRef.current = null;
    ctx.streamRef.current = ctx.initialStreamState();
    ctx.outboxRef.current = [];
    ctx.sync();
    ctx.setIsLoading(true);
    ctx.setConnection("idle");

    void (async () => {
      try {
        const { threads } = await ctx.listThreads(botId, groupId);
        if (cancelled) return;
        const tid = threads[0]?.id;
        if (!tid) {
          ctx.setIsLoading(false);
          return;
        }
        ctx.threadRef.current = tid;
        await ctx.loadHistory(tid);
        if (cancelled) return;
        ctx.setIsLoading(false);
        void ctx.connect(tid);
      } catch (e) {
        if (cancelled) return;
        const info = ctx.toInfo(e);
        ctx.setError(info);
        // Only a failed request is "offline"; a server error has its own toast and must not claim the user lost the network.
        if (info.kind === "network") ctx.setConnection("offline");
        ctx.setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctx.closedRef.current = true;
      if (ctx.timerRef.current) clearTimeout(ctx.timerRef.current);
      if (ctx.resendTimerRef.current) clearTimeout(ctx.resendTimerRef.current);
      ctx.wsRef.current?.close();
    };
  }, [botId, groupId]);
}
