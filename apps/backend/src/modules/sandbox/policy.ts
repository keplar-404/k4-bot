/**
 * Pure rules of a bot's code sandbox, kept apart from E2B and storage so they are checked in policy.check.ts.
 */

/** A sandbox sleeps only when nobody uses it: no bot working in it, no editor open, and idle past the limit. */
export function shouldPause(o: { working: boolean; editorOpen: boolean; idleMs: number; limitMs: number }): boolean {
  return !o.working && !o.editorOpen && o.idleMs > o.limitMs;
}

/** One shell word, whatever it contains: wrapped in single quotes, with each quote closed, escaped and reopened. */
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Seconds a command may run: 1 to 600, 120 by default. */
export const clampTimeout = (s?: number) => Math.min(600, Math.max(1, Math.round(s ?? 120)));

/** UTC day of a timestamp, the key of the daily minutes counter. */
export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The usage counter after one alarm tick: seconds since the last tick (at most two ticks, so a missed alarm is not
 * billed as hours), restarting at 0 on a new day.
 */
export function addUsage(prev: { day: string; seconds: number } | null, lastTick: number, now: number, tickMs: number) {
  const today = dayOf(now);
  const base = prev?.day === today ? prev.seconds : 0;
  return { day: today, seconds: base + Math.min(now - lastTick, 2 * tickMs) / 1000 };
}

/** Replaces exactly one occurrence of `old`; anything else is refused, so an edit never lands in the wrong place. */
export function replaceOnce(content: string, old: string, replacement: string): { ok: true; content: string } | { ok: false; error: string } {
  if (!old) return { ok: false, error: "the text to replace is empty" };
  const count = content.split(old).length - 1;
  if (count === 0) return { ok: false, error: "the text to replace was not found (read the file again; whitespace must match)" };
  if (count > 1) return { ok: false, error: `the text to replace appears ${count} times; include more surrounding lines so it is unique` };
  const at = content.indexOf(old);
  return { ok: true, content: content.slice(0, at) + replacement + content.slice(at + old.length) };
}
