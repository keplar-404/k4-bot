// bun run src/lib/secrets.check.ts — the secret encryption round trip and the ways it must fail.
import { decryptSecret, encryptSecret, secretHint } from "./secrets";

const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const other = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const env = { SECRETS_ENCRYPTION_KEY: key };
const ctx = { userId: "u1", recordId: "r1", purpose: "mcp" };
let failed = 0;

const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
};
const rejects = async (p: Promise<unknown>) => p.then(() => false, () => true);

const secret = '{"token":"patABC123.secretvalue"}';
const sealed = await encryptSecret(env, secret, ctx);
check("round trip", (await decryptSecret(env, sealed, ctx)) === secret);
check("stored form is versioned and hides the value", sealed.startsWith("v1.") && !sealed.includes("patABC123"));
check("same value encrypts differently each time (random IV)", sealed !== (await encryptSecret(env, secret, ctx)));
check("another user's row cannot decrypt it", await rejects(decryptSecret(env, sealed, { ...ctx, userId: "u2" })));
check("another connection cannot decrypt it", await rejects(decryptSecret(env, sealed, { ...ctx, recordId: "r2" })));
const parts = sealed.split(".");
const flipped = parts[3]!.startsWith("A") ? `B${parts[3]!.slice(1)}` : `A${parts[3]!.slice(1)}`;
check("a changed ciphertext is refused", await rejects(decryptSecret(env, [...parts.slice(0, 3), flipped].join("."), ctx)));
check("a wrong key is refused", await rejects(decryptSecret({ SECRETS_ENCRYPTION_KEY: other }, sealed, ctx)));
check("rotation: the previous key still decrypts", (await decryptSecret({ SECRETS_ENCRYPTION_KEY: other, SECRETS_ENCRYPTION_KEY_PREVIOUS: key }, sealed, ctx)) === secret);
check("a missing key is an error, not plaintext", await rejects(encryptSecret({}, secret, ctx)));
check("a short key is refused", await rejects(encryptSecret({ SECRETS_ENCRYPTION_KEY: "c2hvcnQ=" }, secret, ctx)));
check("hint shows only the last 4 characters", secretHint("patABC123.secretvalue") === "…alue");

if (failed) {
  console.error(`secrets: ${failed} check(s) failed`);
  process.exit(1);
}
console.log("secrets: all checks passed");
