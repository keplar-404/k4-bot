import assert from "node:assert/strict";
import { findLeakedKeys, reviewOf, stripPrivate, toPortable } from "./portable";
import { graphSchema } from "./schema";

// Export / import: nothing private to the author leaves, and the result is still a valid graph.
const at = { x: 0, y: 0 };
const graph = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.webhook", position: at, config: { auth: "header", secretName: "HOOK_SECRET" } },
    { id: "g", kind: "action.app", position: at, config: { toolkit: "gmail", tool: "GMAIL_SEND", connectedAccountId: "ca_1", arguments: { to: "{{secrets.EMAIL}}x" } } },
    { id: "b", kind: "ai.bot", position: at, config: { botId: "bot1", prompt: "hi {{ secrets.KEY }}", files: ["00000000-0000-0000-0000-000000000000"] } },
    { id: "h", kind: "action.http", position: at, config: { method: "GET", url: "https://api.example.com/x", auth: { type: "bearer", token: "{{secrets.API}}" } } },
  ],
  edges: [
    { id: "e1", source: "t", target: "g" },
    { id: "e2", source: "g", target: "b" },
    { id: "e3", source: "b", target: "h" },
  ],
  pins: { g: { private: "data" } },
});

const out = toPortable({ name: "W", description: null, graph });
const text = JSON.stringify(out);
assert.ok(!text.includes("secrets."), "secret references are removed");
assert.ok(!text.includes("HOOK_SECRET"), "the webhook secret name is removed");
assert.ok(!text.includes("ca_1"), "connected accounts are removed");
assert.ok(!text.includes("bot1"), "bots are removed");
assert.ok(!text.includes("00000000-0000"), "files are removed");
assert.ok(!text.includes("private"), "pinned data is removed");
assert.equal(out.description, "");
assert.deepEqual(out.requires, { apps: ["gmail"], bots: 1 });
assert.ok(graphSchema.safeParse(out.graph).success, "the export is still a valid graph");

// Stripping twice changes nothing (the import route strips what the export already stripped).
assert.deepEqual(stripPrivate(out.graph), out.graph);

const review = reviewOf(out.graph);
assert.deepEqual(review.hosts, ["api.example.com"]);
assert.equal(review.blocks, 4);

// A token typed straight into a header is reported.
const leaky = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.manual", position: at, config: {} },
    { id: "h", kind: "action.http", position: at, label: "Call API", config: { method: "GET", url: "https://x.io", headers: [{ name: "Authorization", value: "Bearer abcdefghijklmnop1234" }] } },
  ],
  edges: [{ id: "e", source: "t", target: "h" }],
});
assert.deepEqual(findLeakedKeys(leaky), ["Call API"]);
assert.deepEqual(findLeakedKeys(out.graph), []);

console.log("portable: ok");
