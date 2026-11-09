// bun run src/features/workflows/builder/settings/placeholder.check.ts
import assert from "node:assert/strict";
import { placeholderFor } from "./placeholder";

assert.equal(
  placeholderFor({ type: "integer", default: 1, examples: [10] }),
  "1",
  "the default wins",
);
assert.equal(
  placeholderFor({ type: "integer", examples: ["many", 5] }),
  "5",
  "an example of the wrong type is skipped",
);
assert.equal(
  placeholderFor({ type: "string", default: "", examples: ["me"] }),
  "me",
  "an empty default is no default",
);
assert.equal(
  placeholderFor({ type: "string", enum: ["a", "b"], examples: ["c", "b"] }),
  "b",
  "examples must be allowed values",
);
assert.equal(placeholderFor({ type: "boolean", examples: ["yes"] }), undefined);
assert.equal(
  placeholderFor({ type: "string", format: "email" } as never),
  "name@example.com",
);
assert.equal(
  placeholderFor({ type: ["string", "null"], examples: [null, "INBOX"] }),
  "INBOX",
);
assert.equal(
  placeholderFor({ type: "array", examples: ["x", ["a@b.com"]] }),
  '["a@b.com"]',
);
console.log("placeholder: all checks passed");
