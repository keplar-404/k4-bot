import type { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import type { HITLRequest, Interrupt } from "langchain";

export interface ApprovalAction {
  name: string;
  args: Record<string, unknown>;
}

export interface ParsedChunk {
  /** Assistant text to show the user. */
  text?: string;
  usage?: { input: number; output: number };
  /** Set when the run paused for human review. */
  approval?: ApprovalAction[];
}

/**
 * Reads one `[mode, value]` tuple from
 * `agent.stream(..., { streamMode: ["updates", "messages"] })`.
 *
 * `messages` carries every message the graph touches, so only AI chunks from
 * the model node count as answer text; tool output must never reach the
 * transcript. Usage rides on the AI chunks (deltas, so callers sum them).
 */
export function parseChunk(chunk: unknown): ParsedChunk {
  const [mode, value] = chunk as [string, unknown];

  if (mode === "messages") {
    const [message, meta] = value as [BaseMessage, { langgraph_node?: string } | undefined];
    if (message.getType() !== "ai" || meta?.langgraph_node === "tools") return {};
    const usage = (message as AIMessageChunk).usage_metadata;
    return {
      text: message.text || undefined,
      usage: usage && { input: usage.input_tokens, output: usage.output_tokens },
    };
  }

  if (mode === "updates" && value && typeof value === "object" && "__interrupt__" in value) {
    const [first] = (value as { __interrupt__: Interrupt<HITLRequest>[] }).__interrupt__;
    return {
      approval: first?.value.actionRequests.map(({ name, args }) => ({ name, args })) ?? [],
    };
  }

  return {};
}
