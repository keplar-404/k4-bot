import assert from "node:assert/strict";
import { graphSchema } from "./schema";
import { runIssue } from "./validate";

// Manual → Gmail → For each (no list yet) → Set: testing Gmail alone must not be stopped by the unfinished For each.
const at = { x: 0, y: 0 };
const graph = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.manual", position: at, config: {} },
    { id: "g", kind: "action.app", position: at, config: { toolkit: "gmail", tool: "GMAIL_FETCH_EMAILS", version: "1" } },
    { id: "l", kind: "logic.loop", position: at, config: { items: "" } },
    { id: "s", kind: "logic.set", position: at, config: { fields: [{ key: "a", value: "{{loop.item}}" }] } },
  ],
  edges: [
    { id: "e1", source: "t", target: "g" },
    { id: "e2", source: "g", target: "l" },
    { id: "e3", source: "l", target: "s" },
  ],
});

assert.equal(runIssue({ ...graph, stopAfter: "g" }), undefined, "Gmail can be tested alone");
assert.equal(runIssue({ ...graph, stopAfter: "l" })?.nodeId, "l", "testing the For each itself still needs its list");
assert.equal(runIssue(graph)?.nodeId, "l", "a full run still needs every block ready");

console.log("run-issue: ok");
