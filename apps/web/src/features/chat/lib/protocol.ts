/**
 * Wire + view types for the chat slice.
 *
 * Deliberately free of React and DOM so the failure logic can be tested with
 * `bun run src/features/chat/lib/*.check.ts` instead of by clicking around.
 */

import type { FileRef, Part } from "@backend/modules/agent/parts";

/** One piece of an assistant turn: text, reasoning, or a tool call (shared with the server). */
export type MessagePart = Part;

export type { FileRef };

export type DeliveryState = "queued" | "sending" | "sent" | "failed";

export type ChatErrorKind =
  | "network"
  | "auth"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "quota"
  | "too_large"
  | "busy"
  | "server"
  | "timeout"
  | "unknown";

export interface ChatErrorInfo {
  kind: ChatErrorKind;
  message: string;
  retryable: boolean;
  /** Milliseconds the server asked us to wait, when it said so. */
  retryAfterMs?: number;
  /** Raw provider text. For the console/tooltip, never for the bubble. */
  detail?: string;
}

export interface ChatMessageView {
  /** Client-generated and stable across retries. */
  id: string;
  role: "user" | "assistant";
  /** All text of the message. For an assistant message, the concatenated text parts. */
  text: string;
  /** Assistant messages: text, reasoning and tool calls in the order they happened. */
  parts?: MessagePart[];
  /** User messages: the files they attached. */
  files?: FileRef[];
  state: DeliveryState;
  createdAt: number;
  seq?: number;
  error?: ChatErrorInfo;
}

export type RunState =
  | "idle"
  | "running"
  | "waiting_approval"
  | "waiting_input"
  | "sleeping"
  | "done"
  | "failed"
  | "resyncing";

export * from "./errors";
