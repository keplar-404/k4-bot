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

  // `modelKwargs` is merged into the request body, which is where OpenRouter reads `reasoning` and `cache_control`.
  const modelKwargs = {
    ...(effort ? { reasoning: { effort } } : {}),
    ...cachingFor(model.id),
  };
  // `tags`: "nostream" keeps a model's internal calls (the /compact summary) out of the chat's message stream.
  const createModel = (tags?: string[]) => {
    const chat = new ChatOpenRouter({
      ...(tags ? { tags } : {}),
      model: model.id,
      apiKey: options.apiKey,
      maxTokens: options.maxOutputTokens ?? 8192,
      siteUrl: "https://k4.bot",
      siteName: "K4 Bot",
      ...(Object.keys(modelKwargs).length ? { modelKwargs } : {}),
    });
    // The package has no profile for several models, and Deep Agents' automatic summarizing reads the context size
    // from it (without one it waits until 170k tokens, past a 128k window). Room is left for the reply.
    const maxInputTokens = (options.contextLength ?? model.contextLength) - (options.maxOutputTokens ?? 8192);
    Object.defineProperty(chat, "profile", { value: { ...chat.profile, maxInputTokens }, configurable: true });
    return chat;
  };
  return { model, createModel };
}

/**
 * Prompt caching through OpenRouter. Every call resends the same long start (system prompt, tool definitions,
 * the conversation so far), and a cached start is read at a fraction of the price and faster.
 * - Anthropic needs it asked for: one top-level `cache_control` and OpenRouter moves the breakpoint forward as the
 *   conversation grows (5-minute cache, refreshed on every hit). Prompts under the model's minimum (1024 tokens
 *   for Sonnet 4.6, 4096 for Haiku 4.5) are not cached.
 * - OpenAI, DeepSeek, Grok, Moonshot, Groq and Gemini 2.5+ cache on their own; nothing to send.
 * - Free models routed by `openrouter/free`: no cache was reported in testing (cached_tokens stayed 0).
 * https://openrouter.ai/docs/features/prompt-caching
 */
export function cachingFor(modelId: string): { cache_control?: { type: "ephemeral" } } {
  return modelId.startsWith("anthropic/") ? { cache_control: { type: "ephemeral" } } : {};
}

/** A plain OpenRouter model outside the catalog (the free vision model used with the free router). */
export function extraModel(modelId: string, apiKey: string, maxOutputTokens?: number) {
  return new ChatOpenRouter({ model: modelId, apiKey, maxTokens: maxOutputTokens ?? 8192, siteUrl: "https://k4.bot", siteName: "K4 Bot" });
}
