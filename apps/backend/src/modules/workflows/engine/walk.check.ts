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

console.log("walk: all checks passed");
