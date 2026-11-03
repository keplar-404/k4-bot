import assert from "node:assert/strict";
import { initialStreamState, reduceEvent, type StreamState } from "./stream";

const tok = (seq: number, text: string, runId = "r1") => ({
  seq,
  type: "agent.token",
  payload: { runId, text },
});

// 4. run.done finalises the streamed message
let s: StreamState = initialStreamState();
s = reduceEvent(s, tok(1, "Hel")).state;
s = reduceEvent(s, tok(2, "lo")).state;
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

console.log("stream-done: all checks passed");
