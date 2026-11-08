import assert from "node:assert/strict";
import hooks from "./hooks";

// Everything that can be refused before the database is touched: shape, rate limit, content type, size.
const env = (ok = true) => ({ RL_WF_HOOK: { limit: async () => ({ success: ok }) } });
const id = crypto.randomUUID();
const token = "a".repeat(43);
const post = (path: string, init: RequestInit = {}, e = env()) =>
  hooks.request(path, { method: "POST", ...init }, e as never);
const json = { "content-type": "application/json" };

assert.equal(
  (await post(`/not-a-uuid/${token}`, { headers: json, body: "{}" })).status,
  404,
  "a bad id looks like a missing workflow",
);
assert.equal(
  (await post(`/${id}/short`, { headers: json, body: "{}" })).status,
  404,
  "a bad token looks like a missing workflow",
);
assert.equal(
  (await post(`/${id}/${token}`, { headers: json, body: "{}" }, env(false))).status,
  429,
  "rate limited per workflow before anything else",
);
assert.equal((await post(`/${id}/${token}`, { headers: { "content-type": "text/plain" }, body: "x" })).status, 415);
assert.equal(
  (await post(`/${id}/${token}`, { headers: json, body: JSON.stringify({ a: "x".repeat(300 * 1024) }) })).status,
  413,
  "over 256 KB",
);
assert.equal(
  (await hooks.request(`/${id}/${token}`, { method: "GET" }, env() as never)).status,
  404,
  "only POST exists",
);
console.log("hooks: all checks passed");
