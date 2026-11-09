import assert from "node:assert/strict";
import { fitArguments } from "./arguments";

const schema = {
  properties: {
    max_results: { type: "integer" },
    ratio: { type: ["number", "null"] },
    include_payload: { type: "boolean" },
    to: { type: "array", items: { type: "string" } },
    ids: { type: "array", items: { type: "integer" } },
    meta: { type: "object" },
    query: { type: "string" },
    channel: { type: "string", title: "Channel" },
  },
  required: ["channel"],
};

// Template text becomes the declared type (Composio refuses "5" for an integer).
assert.deepEqual(
  fitArguments(schema, {
    max_results: "5",
    ratio: " 0.5 ",
    include_payload: "false",
    to: "a@b.com",
    ids: "[1,2]",
    meta: '{"k":1}',
    query: "5",
    channel: "C1",
  }),
  {
    args: {
      max_results: 5,
      ratio: 0.5,
      include_payload: false,
      to: ["a@b.com"],
      ids: [1, 2],
      meta: { k: 1 },
      query: "5",
      channel: "C1",
    },
  },
);
// Real types pass through; unreadable text is left for Composio to name.
assert.deepEqual(fitArguments(schema, { max_results: 3, channel: "C1" }), { args: { max_results: 3, channel: "C1" } });
assert.deepEqual(fitArguments(schema, { max_results: "many", channel: "C1" }), {
  args: { max_results: "many", channel: "C1" },
});
// Empty optional fields (a template whose data was missing) are dropped; empty required ones are named.
assert.deepEqual(fitArguments(schema, { query: "", channel: "C1" }), { args: { channel: "C1" } });
assert.deepEqual(fitArguments(schema, { channel: "" }), { missing: ["Channel"] });
assert.deepEqual(fitArguments(schema, {}), { missing: ["Channel"] });
// Unknown fields are kept as they are (the schema may be from a newer version).
assert.deepEqual(fitArguments({}, { extra: "1" }), { args: { extra: "1" } });

console.log("arguments: all checks passed");
