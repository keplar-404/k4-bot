import type { Env } from "../../config/env";
import { timingSafeEqualString } from "../../shared/relay-token";
import { composioFor } from "./client";
import type { TriggerEvent } from "./event-runs";

export type Expired = { userId: string; toolkit: string; accountId: string };
type RawEvent = {
  id?: string;
  type?: string;
  metadata?: { user_id?: string };
  data?: { id?: string; user_id?: string; toolkit?: { slug?: string } };
};
type Headers = { id: string; timestamp: string; signature: string };

/** What a verified delivery is about: a trigger event that starts workflows, an expired connection, or neither. */
export type VerifiedEvent = { eventId: string; trigger: TriggerEvent | null; expired: Expired | null };

/** The account a composio.connected_account.expired event is about, when it names one. */
function expiredAccount(raw: RawEvent): Expired | null {
  const userId = raw.data?.user_id ?? raw.metadata?.user_id;
  const toolkit = raw.data?.toolkit?.slug;
  const accountId = raw.data?.id;
  return userId && toolkit && accountId ? { userId, toolkit, accountId } : null;
}

/** Composio's tolerance for a delivery's timestamp, as its SDK uses. */
const TOLERANCE_SECONDS = 300;

/**
 * Composio's signature: HMAC-SHA256 over `${id}.${timestamp}.${body}`, base64, sent as "v1,<sig>" (several may be
 * space separated), and a timestamp within 5 minutes. Done here for every event: the SDK's verifyWebhook also insists
 * the body is a trigger message, and throws the same error for a bad timestamp as for another kind of event.
 */
async function isAuthentic(secret: string, h: Headers, body: string) {
  const seconds = Number.parseInt(h.timestamp, 10);
  if (!h.id || !body || Number.isNaN(seconds) || Math.abs(Date.now() / 1000 - seconds) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${h.id}.${h.timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return h.signature
    .split(" ")
    .map((part) => part.split(","))
    .some(([version, value]) => version === "v1" && value !== undefined && timingSafeEqualString(value, expected));
}

/** Checks a delivery and says what it is about, or null when it is not authentic or not readable. */
export async function verifyEvent(env: Env, secret: string, h: Headers, body: string): Promise<VerifiedEvent | null> {
  if (!(await isAuthentic(secret, h, body))) return null;
  let raw: RawEvent;
  try {
    raw = JSON.parse(body) as RawEvent;
  } catch {
    return null;
  }
  let trigger: TriggerEvent | null = null;
  if (!raw.type || raw.type === "composio.trigger.message") {
    // The SDK reads all three payload versions into one shape (and checks the signature again).
    const verified = await composioFor(env)
      .triggers.verifyWebhook({ payload: body, ...h, secret })
      .catch(() => null);
    if (!verified) return null;
    const p = verified.payload;
    trigger = { triggerId: p.id, userId: p.userId, slug: p.triggerSlug, data: p.payload ?? {} };
  }
  const expired = raw.type === "composio.connected_account.expired" ? expiredAccount(raw) : null;
  return { eventId: raw.id ?? h.id, trigger, expired };
}
