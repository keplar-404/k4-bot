import assert from "node:assert/strict";
import { classifyProviderError, isTransient } from "./provider-error";
import { MAX_MODEL_RETRIES, retryDelayMs } from "./types";

const withStatus = (status: number) => Object.assign(new Error("provider error"), { status });

for (const s of [408, 425, 429, 500, 502, 503, 504, 520, 529]) assert.equal(isTransient(withStatus(s)), true, `${s} is retried`);
for (const s of [400, 401, 402, 403, 404, 422]) assert.equal(isTransient(withStatus(s)), false, `${s} is not retried`);
assert.equal(isTransient(new TypeError("fetch failed")), true, "a network failure is retried");
assert.equal(isTransient(new Error("Provider returned error")), true, "an OpenRouter provider failure is retried");
assert.equal(isTransient(new Error("Cannot read properties of undefined")), false, "a bug is not retried");

// The real failure from this app's database: a free model's upstream pool, status only inside the text.
const upstream = new Error(
  'Provider returned error | metadata: {"raw":"google/gemma-4-26b-a4b-it:free is temporarily rate-limited upstream.","provider_name":"Google AI Studio","provider_error_code":"429","limit_source":"upstream_provider_shared_pool"}',
);
assert.deepEqual(classifyProviderError(upstream), { reason: "upstream_busy", status: 429 });
assert.equal(isTransient(upstream), true, "a busy upstream pool is retried");
const daily = withStatus(429);
daily.message = "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day";
assert.equal(classifyProviderError(daily).reason, "free_daily_limit");
assert.equal(isTransient(daily), false, "the daily free cap is not retried: it lasts until midnight UTC");
assert.equal(classifyProviderError(withStatus(429)).reason, "rate_limited", "a plain 429 is the per-minute limit");
assert.equal(classifyProviderError(withStatus(402)).reason, "no_credits");

// Seen live on this app's key: OpenRouter's per-key spending cap.
assert.equal(classifyProviderError(new Error("Key limit exceeded (total limit). Manage it using https://openrouter.ai/workspaces/default/keys/x")).reason, "key_limit");

assert.equal(MAX_MODEL_RETRIES, 10);
assert.deepEqual([1, 2, 3, 4].map(retryDelayMs), [5_000, 10_000, 20_000, 40_000], "the wait doubles");
assert.equal(retryDelayMs(10), 5 * 60_000, "the wait is capped at 5 minutes");

console.log("run retry: all checks passed");
