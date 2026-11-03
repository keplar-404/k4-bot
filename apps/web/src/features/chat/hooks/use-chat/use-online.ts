import { useEffect } from "react";
import type { ChatCtx } from "./types";

export function useOnline(
  ctxRef: React.MutableRefObject<ChatCtx | null>,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  useEffect(() => {
    const onOnline = () => {
      const ctx = ctxRef.current!;
      const threadId = ctx.threadRef.current;
      if (!threadId) return;
      if (!ctx.wsRef.current || ctx.wsRef.current.readyState > 1) {
        if (ctx.timerRef.current) clearTimeout(ctx.timerRef.current);
        ctx.attemptsRef.current = 0;
        void ctx.connect(threadId);
      }
      void ctx.flushRef.current();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
}
