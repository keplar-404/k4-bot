import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { timingSafeEqualString } from "../../../shared/relay-token";
import { loadSecrets } from "../../secrets/load";
import { triggerOf } from "../graph/triggers";
import type { WebhookConfig } from "../graph/webhook-config";
import type { WorkflowRow } from "../store/workflows";

const v4 = (ip: string) => {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return parts.reduce((n, p) => n * 256 + p, 0);
};

/** Whether `ip` is in the allowlist: exact addresses, or IPv4 CIDR blocks. An empty list allows everyone. */
export function ipAllowed(ip: string, rules: string[]): boolean {
  if (rules.length === 0) return true;
  return rules.some((rule) => {
    const [base, bits] = rule.split("/");
    if (bits === undefined) return base?.toLowerCase() === ip.toLowerCase();
    const a = v4(ip);
    const b = v4(base ?? "");
    const n = Number(bits);
    if (a === null || b === null || !Number.isInteger(n) || n < 0 || n > 32) return false;
    const size = 2 ** (32 - n);
    return Math.floor(a / size) === Math.floor(b / size);
  });
}

/** HMAC-SHA256 of the raw body, as lowercase hex (what Stripe/GitHub-style senders put in their signature header). */
export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The webhook trigger's own checks, after its URL token matched: the IP allowlist, then the header secret or the body
 * signature. Returns why the request is refused, or null. The secret is read from the owner's vault for this check only.
 */
export async function hookRefusal(
  env: Env,
  db: Db,
  w: WorkflowRow,
  request: { ip: string; header: (name: string) => string | undefined; body: string },
): Promise<string | null> {
  const trigger = triggerOf(w.publishedGraph ?? { nodes: [], edges: [] });
  if (trigger?.kind !== "trigger.webhook") return "not a webhook";
  const config = trigger.config as Partial<WebhookConfig>;
  if (!ipAllowed(request.ip, config.ipAllowlist ?? [])) return "ip not allowed";
  if (!config.auth || config.auth === "none") return null;
  if (!config.secretName) return "secret not set";
  const secret = (await loadSecrets(env, db, w.userId, [config.secretName]))[config.secretName];
  if (!secret) return "secret missing";
  if (config.auth === "header") {
    const given = request.header(config.headerName ?? "x-webhook-secret") ?? "";
    return timingSafeEqualString(given, secret) ? null : "bad header secret";
  }
  const prefix = config.signaturePrefix ?? "";
  const raw = request.header(config.signatureHeader ?? "x-signature") ?? "";
  const given = raw.startsWith(prefix) ? raw.slice(prefix.length) : "";
  return timingSafeEqualString(given.toLowerCase(), await hmacHex(secret, request.body)) ? null : "bad signature";
}
