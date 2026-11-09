import assert from "node:assert/strict";
import { listConfig, mergeConfig } from "../graph/list-blocks";
import { runList, runMerge } from "./list-ops";

const L = (o: object) => listConfig.parse(o);
const M = (o: object) => mergeConfig.parse({ inputs: ["a", "b"], ...o });
const people = [{ name: "Ann", age: 30, tags: ["a", "b"], team: "x" }, { name: "Bob", age: "20", tags: [], team: "y" }, { name: "Cy", age: 40, tags: "c", team: "x" }];

assert.deepEqual(runList(L({ operation: "pluck", field: "name" }), people), { items: ["Ann", "Bob", "Cy"] });
assert.deepEqual(runList(L({ operation: "split_out", field: "tags" }), people), { items: ["a", "b", "c"] });
assert.deepEqual(runList(L({ operation: "sum", field: "age" }), people), { result: 90 });
assert.deepEqual(runList(L({ operation: "average", field: "age" }), people), { result: 30 });
assert.deepEqual(runList(L({ operation: "max", field: "age" }), people), { result: 40 });
assert.deepEqual(runList(L({ operation: "min", field: "age" }), []), { result: null });
assert.deepEqual(runList(L({ operation: "count" }), JSON.stringify(people)), { result: 3 });
assert.deepEqual((runList(L({ operation: "sort", field: "age", order: "desc" }), people).items as typeof people).map((p) => p.name), ["Cy", "Ann", "Bob"]);
assert.deepEqual(Object.keys(runList(L({ operation: "group_by", field: "team" }), people).result as object), ["x", "y"]);
assert.deepEqual(runList(L({ operation: "unique", field: "team" }), people).items?.length, 2);
assert.deepEqual(runList(L({ operation: "first_n", amount: 1 }), people).items?.length, 1);
assert.throws(() => runList(L({ operation: "count" }), "nope"), /needs a list/);

assert.deepEqual(runMerge(M({ mode: "append" }), [[1, 2], 3, "", null]), { items: [1, 2, 3] });
assert.deepEqual(runMerge(M({ mode: "combine" }), [{ a: 1, b: 1 }, { b: 2 }, "x"]), { result: { a: 1, b: 2 } });
assert.deepEqual(runMerge(M({ mode: "first" }), ["", null, "B"]), { result: "B" });
assert.deepEqual(
  runMerge(M({ mode: "by_key", key: "id" }), [[{ id: 1, n: "a" }, { id: 2, n: "b" }], [{ id: 2, mail: "b@x" }]]),
  { items: [{ id: 1, n: "a" }, { id: 2, n: "b", mail: "b@x" }] },
);
console.log("list ops: all checks passed");
