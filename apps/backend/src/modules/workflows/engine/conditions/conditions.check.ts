// bun run src/modules/workflows/engine/conditions/conditions.check.ts
import assert from "node:assert/strict";
import type { Condition } from "../../graph/schema";
import { evaluate } from "./index";

const ctx = {
  trigger: { body: { email: "Ada@Example.com", tags: ["vip", "eu"], when: "2026-03-01T10:00:00Z", ts: 1772359200, n: "7", empty: " ", obj: {} } },
  steps: {},
  run: { id: "r", startedAt: "" },
};
const yes = (c: Condition) => evaluate({ combine: "all", conditions: [c] }, ctx);
const ref = (k: string) => `{{trigger.body.${k}}}`;

assert.ok(yes({ left: ref("email"), op: "ends_with", right: "@example.com" }), "case-insensitive by default");
assert.ok(!yes({ left: ref("email"), op: "ends_with", right: "@example.com", caseSensitive: true }));
assert.ok(yes({ left: ref("email"), op: "starts_with", right: "ada" }));
assert.ok(yes({ left: ref("empty"), op: "is_empty" }), "whitespace counts as empty");
assert.ok(yes({ left: ref("obj"), op: "is_empty" }));
assert.ok(yes({ left: ref("tags"), op: "length_equals", right: "2" }));
assert.ok(yes({ left: ref("tags"), op: "length_gt", right: "1" }));
assert.ok(yes({ left: ref("tags"), op: "contains", right: "VIP" }));
assert.ok(yes({ left: ref("when"), op: "date_after", right: "2026-02-28" }));
assert.ok(yes({ left: ref("ts"), op: "date_equals", right: "2026-03-01" }), "seconds since 1970");
assert.ok(!yes({ left: ref("when"), op: "date_before", right: "not a date" }), "unreadable dates are false");
assert.ok(yes({ left: ref("n"), op: "gte", right: "7" }));
assert.ok(!yes({ left: ref("email"), op: "gt", right: "3" }), "text is not a number");
assert.ok(!evaluate({ combine: "all", conditions: [] }, ctx));
// Groups: A and (B or C), one level deep; an empty group is left out.
const T = { left: "1", op: "equals" as const, right: "1" };
const F = { left: "1", op: "equals" as const, right: "2" };
assert.ok(evaluate({ combine: "all", conditions: [T], groups: [{ combine: "any", conditions: [F, T] }] }, ctx));
assert.ok(!evaluate({ combine: "all", conditions: [T], groups: [{ combine: "any", conditions: [F, F] }] }, ctx));
assert.ok(evaluate({ combine: "all", conditions: [], groups: [{ combine: "all", conditions: [T] }, { combine: "any", conditions: [] }] }, ctx));
assert.ok(!evaluate({ combine: "all", conditions: [], groups: [{ combine: "any", conditions: [] }] }, ctx), "only empty groups: false");
console.log("conditions: all checks passed");
