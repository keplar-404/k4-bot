import { scheduleConfig } from "../../schedules/config";
import { nextOccurrence } from "../../schedules/next";
import { isTrigger, type WorkflowGraph, type WorkflowNode } from "./schema";

/** The graph's trigger block (a valid published graph has exactly one). */
export const triggerOf = (g: WorkflowGraph): WorkflowNode | undefined => g.nodes.find(isTrigger);

/**
 * When a schedule trigger is next due after `from`. Null for any other trigger, and for a "once" that has run. The
 * config is parsed again: a graph published before schedules had modes is read straight from the database.
 */
export function nextRunAt(trigger: WorkflowNode | undefined, from = Date.now()): Date | null {
  if (trigger?.kind !== "trigger.schedule") return null;
  const config = scheduleConfig.safeParse(trigger.config);
  return config.success ? nextOccurrence(config.data, from) : null;
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
