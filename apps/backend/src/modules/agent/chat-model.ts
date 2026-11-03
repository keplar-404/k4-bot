import { ChatOpenRouter } from "@langchain/openrouter";
import { DEFAULT_MODEL_ID, resolveModel } from "./models";

/**
 * The catalog model and a factory for fresh chat models of it (the bot and each sub-agent get their own).
 * Every model comes from OpenRouter, through LangChain's own OpenRouter integration.
 */
export function chatModelFor(options: {
  modelId?: string;
  reasoningEffort?: string;
  apiKey: string;
  maxOutputTokens?: number;
  /** The model's real context window (model-context.ts). */
  contextLength?: number;
}) {
  const model = resolveModel(options.modelId ?? DEFAULT_MODEL_ID);
  if (!model) throw new Error(`Unknown model: ${options.modelId}`);
  const effort =
    model.reasoning && options.reasoningEffort && model.reasoningEfforts.includes(options.reasoningEffort)
      ? options.reasoningEffort
      : undefined;

  // `modelKwargs` is merged into the request body, which is where OpenRouter reads `reasoning`.
  const createModel = () => {
    const chat = new ChatOpenRouter({
      model: model.id,
      apiKey: options.apiKey,
      maxTokens: options.maxOutputTokens ?? 8192,
      siteUrl: "https://k4.bot",
      siteName: "K4 Bot",
      ...(effort ? { modelKwargs: { reasoning: { effort } } } : {}),
    });
    // The package has no profile for several models, and Deep Agents' automatic summarizing reads the context size
    // from it (without one it waits until 170k tokens, past a 128k window). Room is left for the reply.
    const maxInputTokens = (options.contextLength ?? model.contextLength) - (options.maxOutputTokens ?? 8192);
    Object.defineProperty(chat, "profile", { value: { ...chat.profile, maxInputTokens }, configurable: true });
    return chat;
  };
  return { model, createModel };
}
