import { isTrigger, type WorkflowGraph, type WorkflowNode } from "./schema";

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 } as const;

/** The graph's trigger block (a valid published graph has exactly one). */
export const triggerOf = (g: WorkflowGraph): WorkflowNode | undefined => g.nodes.find(isTrigger);

/**
 * When an interval schedule is next due after `from`: every N units, on a whole minute (the cron checks once a
 * minute). Null for any other trigger.
 */
export function nextRunAt(trigger: WorkflowNode | undefined, from = Date.now()): Date | null {
  if (trigger?.kind !== "trigger.schedule") return null;
  const interval = trigger.config.every * UNIT_MS[trigger.config.unit];
  return new Date(Math.ceil((from + interval) / 60_000) * 60_000);
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** sha-256 of a webhook token: only this is stored, so a database leak does not leak working webhook URLs. */
export const hashToken = async (token: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

/** A new 256-bit webhook token (base64url), shown to the user once, and its hash for storage. */
export async function newWebhookToken(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { token, hash: await hashToken(token) };
}
