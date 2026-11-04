import type { ToolPart } from "../parts";

/**
 * Reads one agent run through LangChain's event-streaming API
 * (`agent.streamEvents(input, { version: "v3" })`): typed streams for model
 * messages (text, reasoning, usage) and for tool calls (input, output, error).
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 *
 * This replaces parsing `[mode, chunk]` tuples, which is why tool calls and
 * reasoning never used to reach the UI.
 */
export interface RunStream {
  messages: AsyncIterable<{
    text: AsyncIterable<string>;
    reasoning: AsyncIterable<string>;
    usage: PromiseLike<{ input_tokens?: number; output_tokens?: number; input_token_details?: { cache_read?: number } } | undefined>;
  }>;
  toolCalls: AsyncIterable<{
    name: string;
    callId: string;
    input: unknown;
    output: PromiseLike<unknown>;
    status: PromiseLike<string>;
    error: PromiseLike<unknown>;
  }>;
  output: PromiseLike<unknown>;
  interrupted: PromiseLike<boolean> | boolean;
  interrupts: PromiseLike<Array<{ interruptId: string; payload: unknown }>> | Array<{ interruptId: string; payload: unknown }>;
}

export interface RunSink {
  text?: (delta: string) => void | Promise<void>;
  reasoning?: (delta: string) => void | Promise<void>;
  toolStart?: (part: ToolPart) => void | Promise<void>;
  toolEnd?: (part: ToolPart) => void | Promise<void>;
  /** A model message finished or a tool call completed: a good moment to save progress. */
  partsChanged?: () => void | Promise<void>;
  /** One model call finished, with its tokens: its input is how full the context window is now. */
  usage?: (usage: { input: number; output: number; cached: number }) => void | Promise<void>;
}

export interface PendingInterrupt {
  id: string;
  payload: unknown;
}
