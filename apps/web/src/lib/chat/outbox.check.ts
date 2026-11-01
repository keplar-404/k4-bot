import assert from "node:assert/strict";
import { mapHttpError, networkError } from "./protocol";
import {
  backoffMs,
  canRetry,
  due,
  enqueue,
  markFailed,
  markSending,
  markSent,
  requeue,
  type OutboxItem,
} from "./outbox";

const base: OutboxItem = {
  id: "m1",
  threadId: "t1",
  content: "hello",
  createdAt: 1,
  attempts: 0,
  state: "queued",
};

// enqueue is idempotent
assert.equal(enqueue([base], { ...base }).length, 1, "duplicate enqueue must not double-send");

// lifecycle
let items = enqueue([], base);
assert.equal(due(items).length, 1);
items = markSending(items, "m1");
assert.equal(due(items).length, 0, "a sending item is not due again");
items = markFailed(items, "m1", networkError());
assert.equal(items[0]!.state, "failed");
assert.equal(items[0]!.attempts, 1);
assert.equal(canRetry(items[0]!), true);
items = requeue(items, "m1");
assert.equal(items[0]!.state, "queued");
assert.equal(items[0]!.error, undefined);
assert.equal(markSent(items, "m1").length, 0, "sent items leave the queue");

// non-retryable errors stop the loop
const forbidden = markFailed(enqueue([], base), "m1", mapHttpError(403, null));
assert.equal(canRetry(forbidden[0]!), false, "403 must not retry forever");

// attempt ceiling
let exhausted = base;
for (let i = 0; i < 4; i++) exhausted = { ...exhausted, attempts: i + 1 };
assert.equal(canRetry(exhausted), false, "the attempt ceiling must hold");

// backoff is exponential and capped
assert.equal(backoffMs(0), 500);
assert.equal(backoffMs(1), 1000);
assert.equal(backoffMs(5), 15_000, "backoff must cap");

// status mapping
const cases: Array<[number, string, boolean]> = [
  [0, "network", true],
  [401, "auth", false],
  [402, "quota", false],
  [403, "forbidden", false],
  [404, "not_found", false],
  [413, "too_large", false],
  [429, "rate_limit", true],
  [500, "server", true],
  [503, "server", true],
  [504, "timeout", true],
];
for (const [status, kind, retryable] of cases) {
  const info = mapHttpError(status, null);
  assert.equal(info.kind, kind, `status ${status} should map to ${kind}`);
  assert.equal(info.retryable, retryable, `status ${status} retryable should be ${retryable}`);
}

// Retry-After is honoured
const limited = mapHttpError(429, null, "7");
assert.equal(limited.retryAfterMs, 7000);

// server message wins over canned copy
const withMessage = mapHttpError(500, { message: "model exploded" });
assert.equal(withMessage.message, "model exploded");

console.log("outbox + protocol: all checks passed");
