import type { ChatErrorInfo, ChatErrorKind } from "./protocol";

export const errorCopy: Record<ChatErrorKind, string> = {
  network:
    "Connection lost. Your message is saved and will send when you're back.",
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

/** HTTP statuses with their own meaning; any other 5xx is "server", anything else "unknown". */
const STATUS_KIND: Record<number, ChatErrorKind> = {
  0: "network",
  401: "auth",
  402: "quota",
  403: "forbidden",
  404: "not_found",
  408: "timeout",
  413: "too_large",
  429: "rate_limit",
  504: "timeout",
};

/** Maps an HTTP outcome onto a user-facing error. Pure, so it is testable. */
export function mapHttpError(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): ChatErrorInfo {
  const kind: ChatErrorKind =
    STATUS_KIND[status] ?? (status >= 500 ? "server" : "unknown");

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
