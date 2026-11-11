import assert from "node:assert/strict";
import { graphSchema } from "../workflows/graph/schema";
import { buildGraph, graphForModel } from "./graph-edit";

// The assistant edits a workflow: existing blocks keep their place, new ones go under the block they follow.
const prev = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.manual", position: { x: 40, y: 10 }, config: {} },
    { id: "g", kind: "action.app", position: { x: 300, y: 500 }, config: { toolkit: "gmail" } },
  ],
  edges: [{ id: "e", source: "t", target: "g" }],
  pins: { g: { a: 1 } },
});

const { nodes, edges } = graphForModel(prev);
assert.ok(!("position" in nodes[0]!), "the model never sees positions");

const out = buildGraph(prev, [...nodes, { id: "s", kind: "logic.set", config: { fields: [{ key: "a", value: "1" }] } }], [...edges, { source: "g", target: "s" }]);
assert.ok("graph" in out);
assert.deepEqual(out.graph.nodes.find((n) => n.id === "g")!.position, { x: 300, y: 500 }, "existing block kept");
assert.deepEqual(out.graph.nodes.find((n) => n.id === "s")!.position, { x: 300, y: 660 }, "new block under its source");
assert.deepEqual(out.graph.pins, { g: { a: 1 } }, "pinned samples survive an edit");

// Invalid graphs come back as text for the model to fix.
const bad = buildGraph(prev, [...nodes, { id: "x", kind: "logic.nope" }], edges);
assert.ok("error" in bad && bad.error.length > 0);
const loop = buildGraph(prev, nodes, [...edges, { source: "g", target: "t" }]);
assert.ok("error" in loop);

console.log("graph-edit: ok");

// Return ends the workflow: a connection out of it is refused (the canvas has no output dot on it either).
const withReturn = buildGraph(prev, [...nodes, { id: "r", kind: "logic.return", config: { fields: [] } }, { id: "s2", kind: "logic.set", config: { fields: [] } }], [...edges, { source: "g", target: "r" }, { source: "r", target: "s2" }]);
assert.ok("error" in withReturn && /Return ends the workflow/.test(withReturn.error));
console.log("graph-edit return: ok");
