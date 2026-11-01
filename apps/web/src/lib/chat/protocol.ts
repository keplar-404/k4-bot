/**
 * Wire + view types for the chat slice.
 *
 * Deliberately free of React and DOM so the failure logic can be tested with
 * `bun run src/lib/chat/*.check.ts` instead of by clicking around.
 */

export type DeliveryState = "queued" | "sending" | "sent" | "failed";

export type ChatErrorKind =
  | "network"
  | "auth"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "quota"
  | "too_large"
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
  text: string;
  state: DeliveryState;
  createdAt: number;
  seq?: number;
  error?: ChatErrorInfo;
}

export type RunState =
  | "idle"
  | "running"
  | "waiting_approval"
  | "done"
  | "failed"
  | "resyncing";

export const errorCopy: Record<ChatErrorKind, string> = {
  network: "Connection lost. Your message is saved and will send when you're back.",
  auth: "Your session expired. Sign in again to continue.",
  forbidden: "You don't have access to this conversation.",
  not_found: "This conversation no longer exists.",
  rate_limit: "Too many requests — give it a moment.",
  quota: "You've reached today's usage limit.",
  too_large: "That file is too large to upload.",
  server: "Something broke on our side. Your message is saved — try again.",
  timeout: "The model took too long to respond.",
  unknown: "Something went wrong.",
};

const RETRYABLE: Record<ChatErrorKind, boolean> = {
  network: true,
  auth: false,
  forbidden: false,
  not_found: false,
  rate_limit: true,
  quota: false,
  too_large: false,
  server: true,
  timeout: true,
  unknown: true,
};

/** Maps an HTTP outcome onto a user-facing error. Pure, so it is testable. */
export function mapHttpError(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): ChatErrorInfo {
  const kind: ChatErrorKind =
    status === 0
      ? "network"
      : status === 401
        ? "auth"
        : status === 402
          ? "quota"
          : status === 403
            ? "forbidden"
            : status === 404
              ? "not_found"
              : status === 413
                ? "too_large"
                : status === 429
                  ? "rate_limit"
                  : status === 408 || status === 504
                    ? "timeout"
                    : status >= 500
                      ? "server"
                      : "unknown";

  const serverMessage =
    body && typeof body === "object" && "message" in body
      ? String((body as { message?: unknown }).message ?? "")
      : "";

  const seconds = Number(retryAfterHeader ?? "");
  return {
    kind,
    message: serverMessage || errorCopy[kind],
    retryable: RETRYABLE[kind],
    ...(Number.isFinite(seconds) && seconds > 0
      ? { retryAfterMs: Math.round(seconds * 1000) }
      : {}),
  };
}

export function networkError(): ChatErrorInfo {
  return { kind: "network", message: errorCopy.network, retryable: true };
}
