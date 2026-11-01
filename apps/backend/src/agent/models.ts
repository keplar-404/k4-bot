import { z } from "zod";
import rawModels from "./models.json";

const modelConfigSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  free: z.boolean().optional(),
  vision: z.boolean().default(false),
  reasoning: z.boolean().default(false),
  reasoningEfforts: z.array(z.string()).default([]),
  /** Short tier badge shown in the picker. Derived when omitted. */
  tag: z.string().optional(),
});

export type ModelConfig = {
  id: string;
  free: boolean;
  vision: boolean;
  reasoning: boolean;
  reasoningEfforts: string[];
  tag: string;
};

/** Bare OpenRouter id, matching `models[].id`: the UI compares the two directly. */
export const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4.6";

/** The default always leads the list: the picker shows the first entry as selected. */
export const models: ModelConfig[] = z
  .array(modelConfigSchema)
  .parse(rawModels)
  .filter((m) => m.provider === "openrouter")
  .sort((a, b) => Number(b.modelId === DEFAULT_MODEL_ID) - Number(a.modelId === DEFAULT_MODEL_ID))
  .map((m) => {
    // Some entries carry ":free" without the flag; trust either signal so a
    // free model is never labelled as billable.
    const free = m.free ?? m.modelId.endsWith(":free");
    return {
      id: m.modelId,
      free,
      vision: m.vision,
      reasoning: m.reasoning,
      reasoningEfforts: m.reasoningEfforts,
      tag: m.tag ?? (free ? "Free" : m.reasoning ? "Reasoning" : "Standard"),
    };
  });

export const resolveModel = (modelId: string) =>
  models.find((m) => m.id === modelId);
