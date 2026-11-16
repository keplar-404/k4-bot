import { expect, test } from "bun:test";
import type { EveMessagePart } from "eve/react";
import { splitTurn } from "./split-turn";

const tool = (callId: string, stepIndex: number) =>
	({
		type: "tool",
		callId,
		stepIndex,
		kind: "tool",
		name: "web_search",
		label: callId,
		state: "completed",
	}) as unknown as EveMessagePart;
const think = (id: string, stepIndex: number, text = id) =>
	({ type: "reasoning", id, stepIndex, text, state: "done" }) as const;
const say = (id: string, stepIndex: number) =>
	({ type: "text", id, stepIndex, text: id, state: "done" }) as const;

const ids = (s: ReturnType<typeof splitTurn>["steps"]) =>
	s.map((p) => (p.type === "tool" ? p.callId : "id" in p ? p.id : p.type));

test("thinking moves above its step's parallel calls", () => {
	// eve's order from the bug: three calls, then step 0's thought, then later thoughts.
	const { steps, reply } = splitTurn([
		tool("a", 0),
		tool("b", 0),
		tool("c", 0),
		think("t0", 0),
		think("t1", 1),
		tool("d", 1),
		say("answer", 2),
	]);
	expect(ids(steps)).toEqual(["t0", "a", "b", "c", "t1", "d"]);
	expect(reply).toBe("answer");
});

test("think -> tool -> think in one step keeps the real order from the stream", () => {
	const parts = [tool("a", 0), think("t1", 0), think("t2", 0)];
	// Stream order: t1 started, then call a, then t2.
	const order = new Map([
		["t1", 0],
		["a", 1],
		["t2", 2],
	]);
	expect(ids(splitTurn(parts, order).steps)).toEqual(["t1", "a", "t2"]);
	// Without stream info it falls back to the rule.
	expect(ids(splitTurn(parts).steps)).toEqual(["t1", "t2", "a"]);
});

test("narration stays between thinking and calls; empty thinking is dropped", () => {
	const { steps } = splitTurn([
		tool("a", 0),
		say("n", 0),
		think("empty", 0, "  "),
		think("t", 0),
	]);
	expect(ids(steps)).toEqual(["t", "n", "a"]);
});
