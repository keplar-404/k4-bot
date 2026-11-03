import assert from "node:assert/strict";
import { initialStreamState, reduceEvent, type StreamState } from "./stream";

const tok = (seq: number, text: string, runId = "r1") => ({
  seq,
  type: "agent.token",
  payload: { runId, text },
});

let s: StreamState = initialStreamState();
s = reduceEvent(s, tok(1, "Hel")).state;
s = reduceEvent(s, tok(2, "lo")).state;

// 5. failure with no prior token still shows a bubble
const failed = reduceEvent(initialStreamState(), {
  seq: 1,
  type: "run.failed",
  payload: { runId: "r9" },
});
assert.equal(failed.state.run, "failed");
assert.equal(failed.state.messages.length, 1);
assert.equal(failed.state.messages[0]!.state, "failed");
assert.equal(failed.state.messages[0]!.error?.retryable, true);

// 5b. the provider's reason must survive into the bubble
const withReason = reduceEvent(initialStreamState(), {
  seq: 1,
  type: "run.failed",
  payload: {
    runId: "r9",
    error:
      "429 openrouter/free is temporarily rate-limited upstream\nDetails: …",
  },
});
assert.equal(
  withReason.state.messages[0]!.error?.message,
  "This free model's shared pool is busy right now. Try again in a few seconds, or pick another model.",
  "a shared-pool 429 must become plain-English copy, never the provider's stack text",
);

const dailyQuota = reduceEvent(initialStreamState(), {
  seq: 1,
  type: "run.failed",
  payload: {
    runId: "r11",
    error: "429 free-models-per-day limit reached for this account",
  },
});
assert.equal(
  dailyQuota.state.messages[0]!.error?.message,
  "You've used today's free requests for this model. It resets at midnight UTC — or pick a paid model.",
  "a daily free quota must not be confused with a transient busy pool",
);

const deprecated = reduceEvent(initialStreamState(), {
  seq: 1,
  type: "run.failed",
  payload: {
    runId: "r10",
    error: "404 Qwen3 235B A22B was deprecated on Oct 9, 2026.",
  },
});
assert.equal(
  deprecated.state.messages[0]!.error?.message,
  "That model is no longer available. Pick another one.",
);

// 6. interrupt parks the run and keeps the actions to approve
const actions = [{ name: "write_file", args: { file_path: "/a.txt" } }];
const waiting = reduceEvent(s, {
  seq: 3,
  type: "run.waiting_approval",
  payload: { runId: "r1", actions },
});
assert.equal(waiting.state.run, "waiting_approval");
assert.deepEqual(waiting.state.approval, { runId: "r1", actions });
// ...and streaming again after the user decides clears it, on the same bubble
const resumed = reduceEvent(waiting.state, tok(4, "Done"));
assert.equal(resumed.state.approval, null);
assert.equal(resumed.state.messages.length, 1);

// 7. unknown event types advance the cursor without touching the transcript
const unknown = reduceEvent(s, { seq: 3, type: "agent.step", payload: {} });
assert.equal(unknown.state.cursor, 3);
assert.equal(unknown.state.messages[0]!.text, "Hello");

console.log("stream-failed: all checks passed");
