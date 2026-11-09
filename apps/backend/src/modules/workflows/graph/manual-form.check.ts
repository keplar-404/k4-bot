import assert from "node:assert/strict";
import { formField, readForm } from "./manual-form";

const f = (o: object) => formField.parse(o);
const fields = [f({ key: "n", type: "number", required: true }), f({ key: "ok", type: "yes_no" }), f({ key: "tags", type: "list" }), f({ key: "name", label: "Name" })];
assert.deepEqual(readForm(fields, { n: "4.5", ok: "yes", tags: "a, b,", name: "Ann", extra: 1 }), { inputs: { n: 4.5, ok: true, tags: ["a", "b"], name: "Ann", extra: 1 } });
assert.deepEqual(readForm(fields, { n: 2, tags: '["x",1]', ok: false }), { inputs: { n: 2, tags: ["x", 1], ok: false } });
assert.deepEqual(readForm(fields, { n: "", ok: "maybe" }), { problems: ["n is required.", "ok must be yes or no."] });
assert.deepEqual(readForm(fields, { n: "abc" }), { problems: ["n must be a number."] });
assert.deepEqual(readForm([], { any: "x" }), { inputs: { any: "x" } });
console.log("manual form: all checks passed");
