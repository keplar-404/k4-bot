import assert from "node:assert/strict";
import { initialStreamState, reduceEvent, type StreamState } from "./stream";

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

// 8b. a history reload seeds the cursor, so the first live event is not a gap
const seeded = reduceEvent(initialStreamState([], 41), tok(42, "x"));
assert.equal(seeded.effect, "none");
assert.equal(seeded.state.cursor, 42);

// 9. immutability: the previous state keeps its value
const before = s.messages[0]!.text;
reduceEvent(s, tok(3, "!!"));
assert.equal(s.messages[0]!.text, before, "reducer must not mutate its input");

console.log("stream-basic: all checks passed");
