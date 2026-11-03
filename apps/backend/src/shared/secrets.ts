/**
 * Encryption for secrets users give us (MCP server tokens). AES-256-GCM through Web Crypto, the authenticated
 * encryption NIST recommends (SP 800-38D): a random 96-bit IV per value, and a 128-bit tag, so a changed or swapped
 * ciphertext fails to decrypt instead of decrypting to garbage.
 *
 * - The key never touches the database: it is the Worker secret SECRETS_ENCRYPTION_KEY (32 random bytes, base64).
 * - Each value is bound to where it belongs (associated data: user, connection, purpose), so a ciphertext copied
 *   to another user's row cannot be decrypted there.
 * - The stored form names its key ("v1.<keyId>.<iv>.<ciphertext>"), so the key can be rotated: put the old key in
 *   SECRETS_ENCRYPTION_KEY_PREVIOUS, the new one in SECRETS_ENCRYPTION_KEY, and old values still decrypt.
 * - Secrets are decrypted only on the server, right before use, and are never sent back to the browser or logged.
 */

type Keyring = { current: { id: string; key: CryptoKey }; byId: Map<string, CryptoKey> };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toB64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const fromB64Url = (text: string) => new Uint8Array(Buffer.from(text, "base64url"));

async function importKey(base64: string) {
  const raw = new Uint8Array(Buffer.from(base64.trim(), "base64"));
  if (raw.byteLength !== 32) throw new Error("SECRETS_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return {
    id: Buffer.from(digest.slice(0, 4)).toString("hex"),
    key: await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
  };
}

const keyrings = new Map<string, Promise<Keyring>>();

function keyring(env: { SECRETS_ENCRYPTION_KEY?: string; SECRETS_ENCRYPTION_KEY_PREVIOUS?: string }): Promise<Keyring> {
  const current = env.SECRETS_ENCRYPTION_KEY;
  if (!current) throw new SecretsUnavailableError();
  const cacheKey = `${current}|${env.SECRETS_ENCRYPTION_KEY_PREVIOUS ?? ""}`;
  let ring = keyrings.get(cacheKey);
  if (!ring) {
    ring = (async () => {
      const keys = await Promise.all([current, env.SECRETS_ENCRYPTION_KEY_PREVIOUS].filter((k): k is string => Boolean(k)).map(importKey));
      return { current: keys[0]!, byId: new Map(keys.map((k) => [k.id, k.key])) };
    })();
    keyrings.set(cacheKey, ring);
  }
  return ring;
}

export class SecretsUnavailableError extends Error {
  constructor() {
    super("Secret storage is not configured (SECRETS_ENCRYPTION_KEY is missing).");
  }
}

/** Where a secret belongs. Decryption fails unless the same context is given. */
export type SecretContext = { userId: string; recordId: string; purpose: string };

const aad = (c: SecretContext) => encoder.encode(`k4:${c.purpose}:${c.userId}:${c.recordId}`);

export async function encryptSecret(env: Parameters<typeof keyring>[0], plaintext: string, context: SecretContext): Promise<string> {
  const { current } = await keyring(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(context), tagLength: 128 }, current.key, encoder.encode(plaintext)),
  );
  return `v1.${current.id}.${toB64Url(iv)}.${toB64Url(sealed)}`;
}

export async function decryptSecret(env: Parameters<typeof keyring>[0], stored: string, context: SecretContext): Promise<string> {
  const [version, keyId, iv, sealed] = stored.split(".");
  if (version !== "v1" || !keyId || !iv || !sealed) throw new Error("Unreadable secret.");
  const key = (await keyring(env)).byId.get(keyId);
  if (!key) throw new Error("This secret was encrypted with a key that is no longer configured.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64Url(iv), additionalData: aad(context), tagLength: 128 },
    key,
    fromB64Url(sealed),
  );
  return decoder.decode(plain);
}

/** What the UI may show about a stored secret: its last four characters. */
export const secretHint = (value: string) => (value.length > 8 ? `…${value.slice(-4)}` : "…");
