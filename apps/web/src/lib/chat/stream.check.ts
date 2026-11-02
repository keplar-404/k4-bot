import assert from "node:assert/strict";
import {
  applyPending,
  friendlyProviderError,
  initialStreamState,
  mergeToolParts,
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

// 4. run.done finalises the streamed message
const done = reduceEvent(s, {
  seq: 3,
  type: "run.done",
  payload: { runId: "r1" },
});
assert.equal(done.state.run, "done");
assert.equal(done.state.draftId, null);
assert.equal(done.state.messages[0]!.state, "sent");
assert.equal(done.state.messages[0]!.text, "Hello");
assert.equal(
  done.state.messages[0]!.id,
  "r1:assistant",
  "the draft has the id the server stores the message under",
);

// 4b. reasoning, tool calls and text keep their order inside one message
let t: StreamState = initialStreamState();
const feed = (type: string, payload: object) => {
  t = reduceEvent(t, {
    seq: t.cursor + 1,
    type,
    payload: { runId: "r2", ...payload },
  }).state;
};
feed("agent.reasoning", { text: "I should " });
feed("agent.reasoning", { text: "search." });
feed("tool.start", {
  id: "c1",
  name: "internet_search",
  input: '{"query":"x"}',
});
feed("tool.end", { id: "c1", status: "done", output: "results" });
feed("agent.token", { text: "Found " });
feed("agent.token", { text: "it." });
const parts = t.messages[0]!.parts!;
assert.deepEqual(
  parts.map((p) => p.type),
  ["reasoning", "tool", "text"],
  "deltas of the same kind join; a different kind starts a new part",
);
assert.equal(
  parts[0]!.type === "reasoning" && parts[0]!.text,
  "I should search.",
);
assert.deepEqual(parts[1], {
  type: "tool",
  id: "c1",
  name: "internet_search",
  input: '{"query":"x"}',
  status: "done",
  output: "results",
});
assert.equal(t.messages[0]!.text, "Found it.", "text is only the text parts");

// 4c. a failed run ends tool calls that were still running
feed("tool.start", { id: "c2", name: "computer", input: "{}" });
feed("run.failed", { error: "boom" });
const lastTool = t.messages[0]!.parts!.at(-1)!;
assert.equal(lastTool.type === "tool" && lastTool.status, "error");

// 4d. a question parks the run, a resume clears it, on the same message
let q: StreamState = initialStreamState();
q = reduceEvent(q, {
  seq: 1,
  type: "tool.start",
  payload: { runId: "r3", id: "a", name: "ask_user", input: "{}" },
}).state;
q = reduceEvent(q, {
  seq: 2,
  type: "run.waiting_input",
  payload: { runId: "r3", kind: "login", question: "Log in please" },
}).state;
assert.equal(q.run, "waiting_input");
assert.deepEqual(q.prompt, {
  runId: "r3",
  kind: "login",
  question: "Log in please",
});
q = reduceEvent(q, {
  seq: 3,
  type: "run.resumed",
  payload: { runId: "r3" },
}).state;
assert.equal(q.run, "running");
assert.equal(q.prompt, null);
assert.equal(q.messages.length, 1);

// 4e. the question that began before the page loaded is restored from history
const restored = applyPending(initialStreamState([], 40), {
  type: "run.waiting_input",
  payload: { runId: "r4", kind: "info", question: "Still there?" },
});
assert.equal(restored.run, "waiting_input");
assert.equal(restored.cursor, 40, "restoring must not move the cursor");

// 4f. a tool call stored twice (before and after a pause) shows once, latest wins
const merged = mergeToolParts([
  {
    type: "tool",
    id: "a",
    name: "ask_user",
    input: "{}",
    status: "done",
    output: "",
  },
  { type: "text", text: "x" },
  {
    type: "tool",
    id: "a",
    name: "ask_user",
    input: "{}",
    status: "done",
    output: "purple",
  },
]);
assert.equal(merged.length, 2);
assert.equal(merged[0]!.type === "tool" && merged[0]!.output, "purple");

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
