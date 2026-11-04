import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type AnyBackendProtocol, createSummarizationMiddleware } from "deepagents";

/** Deep Agents summarizes at 85% of the context window by default; this project summarizes at 80%. */
const SUMMARIZE_AT = { type: "fraction", value: 0.8 } as const;
/** What is kept as recent context after a summary: Deep Agents' default, 10% of the window. */
const KEEP = { type: "fraction", value: 0.1 } as const;

/**
 * Deep Agents' own summarizer (`createSummarizationMiddleware`, the one every Deep Agent runs). It keeps Deep
 * Agents' middleware name, so it replaces the default one instead of running twice; only the trigger changes:
 * 80% of the model's `maxInputTokens` (chat-model.ts sets it from the live context length). Passing a trigger
 * turns off Deep Agents' computed defaults, so its large-tool-argument truncation is given the same 80% / 10%.
 * With `now` (/compact) it summarizes before this run's first model call, keeping the last two messages.
 * https://docs.langchain.com/oss/javascript/deepagents/context-engineering
 *
 * Deep Agents writes the summary with `request.model` (the bot's own model) when there is one, and that call
 * would stream into the chat as if it were the answer. So the summarizer gets our "nostream" model (LangGraph
 * leaves those calls out of the message stream and the usage meter), and the bot's real call gets its own back.
 */
export function createSummarizeMiddleware(o: { model: BaseChatModel; backend: AnyBackendProtocol; now?: boolean }) {
  const inner = createSummarizationMiddleware({
    model: o.model,
    backend: o.backend,
    ...(o.now
      ? { trigger: { type: "messages", value: 1 }, keep: { type: "messages", value: 2 } }
      : { trigger: SUMMARIZE_AT, keep: KEEP, truncateArgsSettings: { trigger: SUMMARIZE_AT, keep: KEEP } }),
  });
  const wrap = inner.wrapModelCall!;
  return {
    ...inner,
    wrapModelCall: ((request, handler) =>
      wrap({ ...request, model: o.model }, (req) => handler({ ...req, model: request.model }))) as typeof wrap,
  };
}
