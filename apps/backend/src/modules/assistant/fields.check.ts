import assert from "node:assert/strict";
import { describeFields } from "./fields";

// Gmail's Fetch emails inputs, trimmed from the real schema: helper text, defaults and choices survive.
const fields = describeFields({
  type: "object",
  required: ["to"],
  properties: {
    max_results: { type: "integer", description: "Maximum number of messages per page.\n Default of 1 retrieves one message.", default: 1, examples: [10] },
    old: { type: "string", deprecated: true },
    to: { type: "string", description: "Recipient" },
    label_ids: { type: "array", items: { type: "string" }, description: "Labels" },
    sort: { anyOf: [{ type: "string", enum: ["asc", "desc"] }, { type: "null" }] },
    attachments: { type: "array", items: { type: "object", properties: { name: { type: "string" }, size: { type: "number" } } } },
  },
});
assert.equal(fields[0]!.name, "to", "required inputs come first");
assert.ok(fields[0]!.required);
assert.ok(!fields.some((f) => f.name === "old"), "deprecated inputs are left out");
const max = fields.find((f) => f.name === "max_results")!;
assert.equal(max.type, "integer");
assert.equal(max.default, 1);
assert.equal(max.example, 10);
assert.equal(max.help, "Maximum number of messages per page. Default of 1 retrieves one message.");
assert.equal(fields.find((f) => f.name === "label_ids")!.type, "list of string");
assert.deepEqual(fields.find((f) => f.name === "sort")!.choices, ["asc", "desc"]);
assert.deepEqual(fields.find((f) => f.name === "attachments")!.fields!.map((f) => f.name), ["name", "size"]);
assert.deepEqual(describeFields(undefined), []);

console.log("assistant fields: ok");
