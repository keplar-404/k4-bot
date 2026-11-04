export const TICK_MS = 30_000;
/** A bot counts as working this long after its last sandbox action, so a crashed run cannot keep it awake forever. */
export const BUSY_MS = 3 * 60_000;
export const MAX_OUTPUT_CHARS = 30_000;
export const cap = (s: string) => (s.length > MAX_OUTPUT_CHARS ? `${s.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]` : s);

export type SandboxState = "none" | "creating" | "running" | "paused" | "error";

/** What the Durable Object persists across evictions. */
export interface Core {
  state: SandboxState;
  sandboxId?: string;
  /** The owner: every call must come from this user (set on first use). */
  userId?: string;
  lastActivity: number;
  workingUntil: number;
  lastTick: number;
}

/** A sandbox operation's outcome, in words a tool can return. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
