const enc = new TextEncoder();

/**
 * Relay tokens are minted immediately before the WebSocket handshake and are
 * useless afterwards, so they stay short-lived. Five minutes covers a slow
 * connect plus one reconnect attempt; anything longer is a leaked credential.
 */
export const RELAY_TOKEN_TTL_SECONDS = 5 * 60;

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(payload)),
  );
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Byte-wise compare; equal length is required, timing does not depend on content. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const payload = (userId: string, threadId: string, exp: number) =>
  `${userId}:${threadId}:${exp}`;

/**
 * `<expiry>.<hmac>`, expiry in unix seconds.
 *
 * The expiry is inside the signed payload, not a separate field, so a client
 * cannot extend its own lifetime. Minting and verification live here in one
 * file because they must agree byte-for-byte — duplicated HMAC code drifts.
 */
export async function signRelayToken(args: {
  secret: string;
  userId: string;
  threadId: string;
  nowMs?: number;
}): Promise<string> {
  const exp =
    Math.floor((args.nowMs ?? Date.now()) / 1000) + RELAY_TOKEN_TTL_SECONDS;
  const mac = await hmacHex(
    args.secret,
    payload(args.userId, args.threadId, exp),
  );
  return `${exp}.${mac}`;
}

export async function verifyRelayToken(args: {
  secret: string;
  token: string;
  userId: string;
  threadId: string;
  nowMs?: number;
}): Promise<boolean> {
  const dot = args.token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(args.token.slice(0, dot));
  if (!Number.isInteger(exp)) return false;
  if (exp * 1000 <= (args.nowMs ?? Date.now())) return false;
  const mac = await hmacHex(
    args.secret,
    payload(args.userId, args.threadId, exp),
  );
  return timingSafeEqualString(mac, args.token.slice(dot + 1));
}
