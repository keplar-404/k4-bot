/**
 * Deterministic guardrails for the computer. Pure functions, no I/O.
 *
 * LangChain's guardrails guide distinguishes deterministic checks (cheap,
 * predictable) from model-based ones (slower, costly). Everything a prompt
 * injection could abuse for free (URLs, key names, typed secrets, shell
 * quoting) is checked here, before it reaches the VM.
 */

export type { Checked } from "./checked";
export * from "./input";
export * from "./network";
export * from "./unix";
