// bun run src/modules/composio/schema-quality.check.ts
import assert from "node:assert/strict";
import { inputProblems } from "./schema-quality";

assert.deepEqual(
  inputProblems({
    max_results: { type: "integer", description: "How many", default: 10, examples: ["ten"] },
    query: { type: "string" },
    labels: { type: "array", description: "Labels", examples: [["INBOX"]] },
    flag: { type: "boolean", description: "On", default: "maybe" },
  }),
  [
    { field: "max_results", problem: "example_wrong_type" },
    { field: "query", problem: "no_description" },
    { field: "flag", problem: "default_wrong_type" },
  ],
);
assert.deepEqual(inputProblems({ ok: { type: ["string", "null"], description: "x", examples: [null, "a"] } }), []);
console.log("schema quality: all checks passed");
