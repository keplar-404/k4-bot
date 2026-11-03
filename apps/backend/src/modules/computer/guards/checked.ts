/** The result of a guard: the cleaned value, or a reason the agent is told. */
export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };
export const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
