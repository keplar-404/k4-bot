import { useEffect } from "react";
import type { ModelRow } from "@/features/chat/lib/client";
import type { ChatCtx } from "./types";

export function useModels(
  ctxRef: React.MutableRefObject<ChatCtx | null>,
  botId: string,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  useEffect(() => {
    const ctx = ctxRef.current!;
    let cancelled = false;
    void (async () => {
      try {
        const [res, found] = await Promise.all([
          ctx.listModels(),
          ctx.fetchBot(botId),
        ]);
        if (cancelled) return;
        ctx.setModels(res.models);
        const saved = found.ok ? found.bot : undefined;
        const model =
          res.models.find((m: ModelRow) => m.id === saved?.modelId) ??
          res.models.find((m: ModelRow) => m.id === res.defaultModel) ??
          res.models[0];
        if (!model) return;
        const effort =
          saved?.modelId === model.id &&
          saved.reasoningEffort &&
          model.reasoningEfforts.includes(saved.reasoningEffort)
            ? saved.reasoningEffort
            : (model.reasoningEfforts[0] ?? null);
        ctx.select(model.id, effort);
      } catch {
        // A missing catalog must not block chatting.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId]);
}
