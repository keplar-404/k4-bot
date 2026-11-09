import assert from "node:assert/strict";
import composioEvents from "./events-route";

// Everything refused before the database is touched: no secret configured, and a missing or wrong signature.
const post = (env: object, headers: Record<string, string> = {}, body = "{}") =>
  composioEvents.request(
    "/",
    { method: "POST", headers: { "content-type": "application/json", ...headers }, body },
    {
      DATABASE_URL: "postgres://u:p@localhost/db",
      BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
      BETTER_AUTH_URL: "http://localhost:8787",
      COMPOSIO_API_KEY: "test",
      ...env,
    } as never,
  );

assert.equal((await post({})).status, 503, "no webhook secret: events are refused");
const secret = { COMPOSIO_WEBHOOK_SECRET: "whsec_" + "a".repeat(32) };
assert.equal((await post(secret)).status, 401, "no signature");
const forged = {
  "webhook-id": "msg_1",
  "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
  "webhook-signature": "v1,AAAA",
};
assert.equal((await post(secret, forged)).status, 401, "a wrong signature");

// Any kind of event (not only trigger messages) must be signed with the secret, and be recent.
const { createHmac } = await import("node:crypto");
const expiredBody = JSON.stringify({ id: "msg_x", type: "composio.connected_account.expired", data: { id: "ca", user_id: "u", toolkit: { slug: "gmail" } } });
const signed = (key: string, at = Math.floor(Date.now() / 1000)) => ({
  "webhook-id": "msg_x",
  "webhook-timestamp": String(at),
  "webhook-signature": `v1,${createHmac("sha256", key).update(`msg_x.${at}.${expiredBody}`).digest("base64")}`,
});
assert.equal((await post(secret, {}, expiredBody)).status, 401, "an unsigned expiry event");
assert.equal((await post(secret, signed("another-secret-0123456789"), expiredBody)).status, 401, "an expiry event signed with another key");
const old = signed(secret.COMPOSIO_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 600);
assert.equal((await post(secret, old, expiredBody)).status, 401, "a replayed (10 minute old) event");
console.log("composio events: all checks passed");
