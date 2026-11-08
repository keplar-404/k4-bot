/** A failure a retry cannot fix (bad input, a missing account or secret, a 4xx): the block fails at once. */
export class FatalBlockError extends Error {}

/** An error as a short sentence that is safe to show: no bearer tokens, no long key-like strings, no stack. */
export function userMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}
