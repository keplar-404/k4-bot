import { z } from "zod";
import rawModels from "./models.json";

const modelConfigSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  /** Picker label. Defaults to the last part of the model id. */
  name: z.string().optional(),
  /** Free tier. The only free entry is `openrouter/free`, which routes across OpenRouter's free models. */
  free: z.boolean().default(false),
  vision: z.boolean().default(false),
  reasoning: z.boolean().default(false),
  reasoningEfforts: z.array(z.string()).default([]),
  /** Short tier badge shown in the picker. Derived when omitted. */
  tag: z.string().optional(),
});

export type ModelConfig = {
  id: string;
  name: string;
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
  .map((m) => ({
    id: m.modelId,
    name: m.name ?? m.modelId.split("/").pop() ?? m.modelId,
    free: m.free,
    vision: m.vision,
    reasoning: m.reasoning,
    reasoningEfforts: m.reasoningEfforts,
    tag: m.tag ?? (m.free ? "Free" : m.reasoning ? "Reasoning" : "Standard"),
  }));

export const resolveModel = (modelId: string) =>
  models.find((m) => m.id === modelId);
