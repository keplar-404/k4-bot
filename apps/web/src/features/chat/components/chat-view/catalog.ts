import type { ModelRow } from "@/features/chat/lib/client";

/** PromptBar expects { key, name, ... }; the API speaks full OpenRouter ids. */
export const toCatalog = (models: ModelRow[]) =>
  models.map((m) => ({
    key: m.id,
    name: m.name,
    tag: m.tag,
    vision: m.vision,
    reasoning: m.reasoning,
    reasoningEfforts: m.reasoningEfforts,
    contextLength: m.contextLength,
    free: m.free || m.id.endsWith(":free"),
  }));
