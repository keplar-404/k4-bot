import { z } from "zod";
import { SECRET_NAME } from "../../secrets/store";

const headerName = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
/** One IPv4/IPv6 address or an IPv4 CIDR block ("203.0.113.0/24"). */
const ipRule = z.string().regex(/^(?:\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?|[0-9a-fA-F:]{2,45})$/);

/**
 * Who may start a webhook workflow. The secret URL is always required; on top of it:
 * - "header": the caller sends a shared secret in a header (constant-time compared);
 * - "hmac": the caller signs the raw body with HMAC-SHA256 and sends the hex digest (Stripe/GitHub style), so a leaked
 *   URL alone is not enough and the body cannot be altered on the way.
 * The secret lives in the user's vault (`secretName`), never in the workflow. `ipAllowlist` limits who may call.
 */
export const webhookConfig = z.object({
  auth: z.enum(["none", "header", "hmac"]).default("none"),
  secretName: z.string().regex(SECRET_NAME).optional(),
  headerName: headerName.default("x-webhook-secret"),
  signatureHeader: headerName.default("x-signature"),
  /** Text before the hex digest in the signature header, e.g. "sha256=" (GitHub). Empty for a bare digest. */
  signaturePrefix: z.string().max(20).default("sha256="),
  ipAllowlist: z.array(ipRule).max(20).default([]),
});

export type WebhookConfig = z.infer<typeof webhookConfig>;
