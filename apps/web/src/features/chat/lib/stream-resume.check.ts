import assert from "node:assert/strict";
import {
  applyPending,
  initialStreamState,
  mergeToolParts,
  reduceEvent,
  type StreamState,
} from "./stream";

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

console.log("stream-resume: all checks passed");
