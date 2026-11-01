import assert from "node:assert/strict";
import {
  friendlyProviderError,
  initialStreamState,
  reduceEvent,
  type StreamState,
} from "./stream";

const tok = (seq: number, text: string, runId = "r1") => ({
  seq,
  type: "agent.token",
  payload: { runId, text },
});

// 1. tokens append to one draft bubble
let s: StreamState = initialStreamState();
s = reduceEvent(s, tok(1, "Hel")).state;
s = reduceEvent(s, tok(2, "lo")).state;
assert.equal(s.cursor, 2);
assert.equal(s.messages.length, 1, "one draft bubble, not one per token");
assert.equal(s.messages[0]!.text, "Hello");
assert.equal(s.run, "running");

// 2. a duplicate is dropped, not re-appended
const dup = reduceEvent(s, tok(2, "lo"));
assert.equal(
  dup.state.messages[0]!.text,
  "Hello",
  "duplicate must not duplicate text",
);
assert.equal(dup.state.cursor, 2);

// 3. a gap asks for resync and is NOT applied
const gapState = reduceEvent(s, tok(9, "lost"));
assert.equal(gapState.effect, "resync");
assert.equal(gapState.state.cursor, 2, "a hole must not advance the cursor");
assert.equal(
  gapState.state.messages[0]!.text,
  "Hello",
  "a hole must not render",
);

// 4. run.done finalises with authoritative parts
const done = reduceEvent(s, {
  seq: 3,
  type: "run.done",
  payload: { runId: "r1", parts: [{ type: "text", text: "Hello world" }] },
});
assert.equal(done.state.run, "done");
assert.equal(done.state.draftId, null);
assert.equal(done.state.messages[0]!.state, "sent");
assert.equal(
  done.state.messages[0]!.text,
  "Hello world",
  "final text comes from the run",
);

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
      "429 gemma-4-31b-it:free is temporarily rate-limited upstream\nDetails: …",
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

// 8. classification uses the status, not digits inside the text
assert.equal(
  friendlyProviderError("x", 403),
  "That model isn't available to this app. Pick another one.",
);
assert.equal(
  friendlyProviderError("Provider returned error (request 4041-abc)", 503),
  "The model provider had a problem. Try again, or pick another model.",
  "404 inside a request id must not read as model-not-found",
);
assert.equal(
  friendlyProviderError("401 bad key"),
  "The model provider rejected the API key. Check OPENROUTER_API_KEY.",
);

// 8b. a history reload seeds the cursor, so the first live event is not a gap
const seeded = reduceEvent(initialStreamState([], 41), tok(42, "x"));
assert.equal(seeded.effect, "none");
assert.equal(seeded.state.cursor, 42);

// 9. immutability: the previous state keeps its value
const before = s.messages[0]!.text;
reduceEvent(s, tok(3, "!!"));
assert.equal(s.messages[0]!.text, before, "reducer must not mutate its input");

console.log("stream: all checks passed");
