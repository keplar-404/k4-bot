import assert from "node:assert/strict";
import { mergeShape, schemaAt, shapeOf, unwrapComposio } from "./shape";

// Composio's wrapper is dropped: the run stores only `data`.
const vague = unwrapComposio({
  properties: {
    data: { type: "object", description: "Data from the action" },
    error: {},
    successful: {},
  },
});
assert.equal(vague.description, "Data from the action");

// A real output fills in what the schema left vague, any depth deep, lists included.
const real = shapeOf({
  messages: [{ subject: "Hi", preview: { body: "x" } }],
  resultSizeEstimate: 201,
});
const merged = mergeShape(vague, real);
assert.equal(
  merged.description,
  "Data from the action",
  "the schema's words stay",
);
assert.equal(schemaAt(merged, "messages")?.type, "array");
assert.equal(schemaAt(merged, "messages.0.preview.body")?.type, "string");
assert.equal(schemaAt(merged, "resultSizeEstimate")?.type, "number");
assert.equal(schemaAt(merged, "nope"), null);

// Values never end up in the shape.
assert.ok(!JSON.stringify(real).includes("Hi"));

console.log("shape: ok");
