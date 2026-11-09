import assert from "node:assert/strict";
import { setConfig } from "../graph/blocks";
import { runSet } from "./set-fields";

const ctx = { trigger: { user: { id: 7, name: "Ann" }, n: "42" }, steps: {}, run: { id: "r", startedAt: "" } };
const c = (o: object) => setConfig.parse(o);
assert.deepEqual(
  runSet(c({ fields: [{ key: "n", value: "{{trigger.n}}", type: "number" }, { key: "ok", value: "yes", type: "yes_no" }, { key: "tags", value: "a, b", type: "list" }, { key: "o", value: '{"x":1}', type: "object" }, { key: "t", value: "hi" }] }), ctx),
  { n: 42, ok: true, tags: ["a", "b"], o: { x: 1 }, t: "hi" },
);
assert.deepEqual(runSet(c({ base: "{{trigger.user}}", fields: [{ key: "name", value: "Bo" }] }), ctx), { id: 7, name: "Bo" });
assert.throws(() => runSet(c({ fields: [{ key: "n", value: "abc", type: "number" }] }), ctx), /n must be a number/);
assert.throws(() => runSet(c({ base: "{{trigger.n}}", fields: [] }), ctx), /must be an object/);
console.log("set fields: all checks passed");
