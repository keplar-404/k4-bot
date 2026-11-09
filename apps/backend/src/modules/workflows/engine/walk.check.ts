// The walk with a fake Workflow step: For each passes, durable step names, and Ask me first.
import assert from "node:assert/strict";
import { graphSchema } from "../graph/schema";
import { publishIssues } from "../graph/validate";
import type { NodeDeps } from "./durable";
import type { RunContext } from "./template";
import { runBlocks } from "./walk";

const names: string[] = [];
let answer = { approved: true, note: "", at: "now" };
const step = {
  do: async (name: string, a: unknown, b?: unknown) => {
    names.push(name);
    const fn = (typeof a === "function" ? a : b) as (ctx: { attempt: number }) => Promise<unknown>;
    return fn({ attempt: 1 });
  },
  sleep: async () => undefined,
  waitForEvent: async (name: string) => {
    names.push(name);
    return { payload: answer };
  },
} as never;
const logged: Array<{ id: string; status: string }> = [];
const deps = {
  env: {},
  db: {},
  run: { id: "r", userId: "u" },
  log: { step: async (n: { id: string }, u: { status: string }) => void logged.push({ id: n.id, status: u.status }), isCancelled: async () => false },
} as unknown as NodeDeps;

const pos = { x: 0, y: 0 };
const graph = (nodes: unknown[], edges: Array<[string, string]>) =>
  graphSchema.parse({ nodes, edges: edges.map(([source, target], i) => ({ id: `e${i}`, source, target })) });
const set = (id: string, value: string) => ({ id, kind: "logic.set", position: pos, config: { fields: [{ key: "v", value }] } });
const ctxOf = (): RunContext => ({ trigger: { inputs: { list: ["a", "b", "c"] } }, steps: {}, run: { id: "r", startedAt: "" } });

// For each: the block after it runs once per item, each pass a durable step of its own.
const looped = graph(
  [
    { id: "t", kind: "trigger.manual", position: pos, config: {} },
    { id: "each", kind: "logic.loop", position: pos, config: { items: "{{trigger.inputs.list}}" } },
    set("x", "{{loop.index}}:{{loop.item}}"),
  ],
  [["t", "each"], ["each", "x"]],
);
assert.deepEqual(publishIssues(looped), []);
const ctx = ctxOf();
assert.deepEqual(await runBlocks(step, deps, looped, ctx), { status: "succeeded" });
assert.deepEqual(ctx.steps.x?.output, { v: "2:c" }, "the last pass's output stays");
assert.ok(["block:x#0", "block:x#1", "block:x#2"].every((n) => names.includes(n)));

// Done output: the block there runs once, after every item, and reads each pass's result.
const withDone = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.manual", position: pos, config: {} },
    { id: "each", kind: "logic.loop", position: pos, config: { items: "{{trigger.inputs.list}}" } },
    set("x", "{{loop.item}}!"),
    set("sum", "{{steps.each.output.results}}"),
  ],
  edges: [
    { id: "a", source: "t", target: "each" },
    { id: "b", source: "each", target: "x" },
    { id: "c", source: "each", target: "sum", branch: "done" },
  ],
});
assert.deepEqual(publishIssues(withDone), []);
const doneCtx = ctxOf();
assert.deepEqual(await runBlocks(step, deps, withDone, doneCtx), { status: "succeeded" });
assert.ok(names.includes("block:sum") && !names.includes("block:sum#0"), "after Done runs once");
assert.deepEqual((doneCtx.steps.sum?.output as { v: unknown }).v, [{ v: "a!" }, { v: "b!" }, { v: "c!" }]);
const crossed = graphSchema.parse({ ...withDone, edges: [...withDone.edges, { id: "d", source: "x", target: "sum" }] });
assert.ok(publishIssues(crossed).some((i) => /both repeated/.test(i.message)));

// Test runs: a pinned block is not run (its pin stands in), and "test this step" skips what comes after it.
const chain = graph([{ id: "t", kind: "trigger.manual", position: pos, config: {} }, set("a", "A"), set("b", "{{steps.a.output.v}}!"), set("c", "C")], [["t", "a"], ["a", "b"], ["b", "c"]]);
const pinned = ctxOf();
names.length = 0;
await runBlocks(step, deps, chain, pinned, { pins: { a: { v: "pinned" } }, stopAfter: "b" });
assert.deepEqual(pinned.steps.b?.output, { v: "pinned!" });
assert.ok(names.includes("pin:a") && !names.includes("block:a"), "pinned: not run");
assert.ok(names.includes("skip:c") && !names.includes("block:c"), "after the tested step: skipped");

// Not a list: the loop block fails with a clear message.
const bad = ctxOf();
bad.trigger = { inputs: { list: "nope" } };
const failed = await runBlocks(step, deps, looped, bad);
assert.equal(failed.status, "failed");
assert.match((failed as { error: string }).error, /needs a list/);

// Two loops, and a loop with nothing after it, are refused.
const two = graph(
  [{ id: "t", kind: "trigger.manual", position: pos, config: {} }, { id: "l1", kind: "logic.loop", position: pos, config: { items: "{{x}}" } }, { id: "l2", kind: "logic.loop", position: pos, config: { items: "{{x}}" } }],
  [["t", "l1"], ["l1", "l2"]],
);
assert.ok(publishIssues(two).some((i) => /one For each/.test(i.message)));

// Ask me first: declined stops the path after it, the run still succeeds.
const asked = graph(
  [{ id: "t", kind: "trigger.manual", position: pos, config: {} }, { id: "ok", kind: "logic.approval", position: pos, config: { message: "Send?" } }, set("send", "yes")],
  [["t", "ok"], ["ok", "send"]],
);
answer = { approved: false, note: "no", at: "now" };
const declined = ctxOf();
assert.deepEqual(await runBlocks(step, deps, asked, declined), { status: "succeeded" });
assert.equal(declined.steps.send, undefined, "declined: the block after it is skipped");
assert.ok(logged.some((l) => l.id === "ok" && l.status === "waiting"));
answer = { approved: true, note: "", at: "now" };
const approved = ctxOf();
await runBlocks(step, deps, asked, approved);
assert.deepEqual(approved.steps.send?.output, { v: "yes" });

// Switch: the first matching rule's output runs, the others are skipped; no match → "otherwise".
const switched = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.manual", position: pos, config: {} },
    {
      id: "sw",
      kind: "logic.switch",
      position: pos,
      config: {
        rules: [
          { id: "vip", conditions: [{ left: "{{trigger.inputs.tier}}", op: "equals", right: "vip" }] },
          { id: "pro", conditions: [{ left: "{{trigger.inputs.tier}}", op: "equals", right: "pro" }] },
        ],
      },
    },
    set("a", "vip"),
    set("b", "pro"),
    set("c", "other"),
  ],
  edges: [
    { id: "e0", source: "t", target: "sw" },
    { id: "e1", source: "sw", target: "a", branch: "vip" },
    { id: "e2", source: "sw", target: "b", branch: "pro" },
    { id: "e3", source: "sw", target: "c", branch: "otherwise" },
  ],
});
assert.deepEqual(publishIssues(switched), []);
const routeOf = async (tier: string) => {
  const c: RunContext = { trigger: { inputs: { tier } }, steps: {}, run: { id: "r", startedAt: "" } };
  await runBlocks(step, deps, switched, c);
  return ["a", "b", "c"].filter((id) => c.steps[id]);
};
assert.deepEqual(await routeOf("pro"), ["b"]);
assert.deepEqual(await routeOf("VIP"), ["a"], "text comparison ignores case");
assert.deepEqual(await routeOf("free"), ["c"]);
const staleEdge = graphSchema.parse({ ...switched, edges: [...switched.edges, { id: "e4", source: "sw", target: "c", branch: "gone" }] });
assert.ok(publishIssues(staleEdge).some((i) => /no longer exists/.test(i.message)));

console.log("walk: all checks passed");
