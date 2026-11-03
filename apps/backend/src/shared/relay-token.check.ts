import assert from "node:assert/strict";
import {
  RELAY_TOKEN_TTL_SECONDS,
  signRelayToken,
  verifyRelayToken,
} from "./relay-token";

/**
 * One runnable check for the relay-token format. Run with:
 *   bun run check:relay-token
 * It is a plain script on purpose: no test runner, no fixtures. If this file
 * fails, a WebSocket can be opened by someone who should not be able to.
 */
const secret = "s".repeat(32);
const other = "o".repeat(32);
const userId = "user-1";
const threadId = "thread-1";
const t0 = 1_800_000_000_000; // fixed clock: the check must not depend on today

const valid = await signRelayToken({ secret, userId, threadId, nowMs: t0 });

assert.equal(
  await verifyRelayToken({ secret, token: valid, userId, threadId, nowMs: t0 }),
  true,
  "a freshly minted token must verify",
);

// one second past expiry
const afterExpiry = t0 + (RELAY_TOKEN_TTL_SECONDS + 1) * 1000;
assert.equal(
  await verifyRelayToken({ secret, token: valid, userId, threadId, nowMs: afterExpiry }),
  false,
  "an expired token must be rejected",
);

// still inside the window, right at the edge
const justBefore = t0 + (RELAY_TOKEN_TTL_SECONDS - 1) * 1000;
assert.equal(
  await verifyRelayToken({ secret, token: valid, userId, threadId, nowMs: justBefore }),
  true,
  "a token must stay valid inside its TTL",
);

assert.equal(
  await verifyRelayToken({ secret, token: valid, userId, threadId: "thread-2", nowMs: t0 }),
  false,
  "a token must not open a different thread",
);

assert.equal(
  await verifyRelayToken({ secret, token: valid, userId: "user-2", threadId, nowMs: t0 }),
  false,
  "a token must not open a different user",
);

assert.equal(
  await verifyRelayToken({ secret: other, token: valid, userId, threadId, nowMs: t0 }),
  false,
  "a token signed with another secret must not verify",
);

const [exp, mac] = valid.split(".");
assert.equal(
  await verifyRelayToken({ secret, token: `${Number(exp) + 60}.${mac}`, userId, threadId, nowMs: t0 }),
  false,
  "extending the expiry must invalidate the signature",
);

const flipped = mac.slice(0, -1) + (mac.endsWith("0") ? "1" : "0");
assert.equal(
  await verifyRelayToken({ secret, token: `${exp}.${flipped}`, userId, threadId, nowMs: t0 }),
  false,
  "a tampered signature must not verify",
);

for (const bad of ["", "nodot", ".abc", "abc.def", "1e9.00"]) {
  assert.equal(
    await verifyRelayToken({ secret, token: bad, userId, threadId, nowMs: t0 }),
    false,
    `malformed token must be rejected: ${JSON.stringify(bad)}`,
  );
}

console.log("relay-token: all checks passed");
