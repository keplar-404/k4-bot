import type { Context } from "hono";
import { ComposioNotConfigured } from "./client";

/**
 * A failed Composio call as a clean API answer: 503 when the feature is not configured, 502 when Composio itself
 * failed. Composio's own message and request id go to the logs (for its dashboard), not to the browser.
 */
export function composioError(c: Context, error: unknown, action: string) {
  if (error instanceof ComposioNotConfigured) {
    return c.json({ error: "NOT_CONFIGURED", message: "Connected apps are not set up on this server." }, 503);
  }
  const e = error as { message?: string; status?: number; requestId?: string; cause?: unknown };
  console.error(`[composio] ${action} failed`, {
    message: e.message,
    status: e.status,
    requestId: e.requestId,
    cause: String(e.cause ?? ""),
  });
  return c.json({ error: "UPSTREAM_FAILED", message: `Could not ${action} right now. Try again in a moment.` }, 502);
}
