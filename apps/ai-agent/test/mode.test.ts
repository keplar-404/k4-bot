import { expect, test } from "bun:test";
import { modeOf, notInPlan } from "../agent/lib/mode";

const as = (mode: unknown) => ({
	session: { auth: { current: { attributes: { mode } } } },
});

test("an unknown or missing mode counts as Ask, never Full", () => {
	expect(modeOf(as("full").session)).toBe("full");
	expect(modeOf(as("FULL").session)).toBe("ask");
	expect(modeOf(as(undefined).session)).toBe("ask");
	expect(modeOf({ auth: { current: null } })).toBe("ask");
});

test("Plan mode hides the tool; Ask and Full keep it", () => {
	const pick = notInPlan("tool");
	expect(pick(as("plan"))).toBeNull();
	expect(pick(as("ask"))).toBe("tool");
	expect(pick(as("full"))).toBe("tool");
});
