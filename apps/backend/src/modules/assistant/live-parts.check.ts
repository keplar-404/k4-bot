import assert from "node:assert/strict";
import type { Part } from "../agent/parts";
import { partsForLive } from "./live-parts";

// What is pushed live while the assistant works: recent steps whole, older results shortened, never unbounded.
const tool = (i: number, size: number): Part => ({ type: "tool", id: `t${i}`, name: "get_workflow", input: "{}", status: "done", output: "x".repeat(size) });
const few = partsForLive([tool(0, 3000), { type: "text", text: "hi" }, tool(1, 3000)]);
assert.equal((few[0] as { output: string }).output.length, 3000, "a short turn is sent whole");

const many = partsForLive(Array.from({ length: 12 }, (_, i) => tool(i, 3000)));
assert.ok((many[0] as { output: string }).output.length < 600, "older results are shortened");
assert.equal((many.at(-1) as { output: string }).output.length, 3000, "the newest step is whole");

const huge = partsForLive(Array.from({ length: 400 }, (_, i) => tool(i, 4000)));
assert.ok(JSON.stringify(huge).length <= 120_000, "capped");
assert.equal((huge.at(-1) as { id: string }).id, "t399", "the newest parts are the ones kept");

console.log("assistant live parts: ok");
