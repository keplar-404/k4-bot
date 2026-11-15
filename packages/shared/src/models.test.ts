import { expect, test } from "bun:test";
import { defaultModelId, findModel, pickEffort } from "./models";

// The allowlist is a cost/security check: the browser picks the model.
test("unknown model falls back to the free default", () => {
	expect(findModel("openai/some-expensive-model").id).toBe(defaultModelId);
	expect(findModel(undefined).id).toBe(defaultModelId);
});

test("effort must be one the model supports", () => {
	const sonnet = findModel("anthropic/claude-sonnet-5.5");
	expect(pickEffort(sonnet, "low")).toBe("low");
	expect(pickEffort(sonnet, "max")).toBe(sonnet.defaultEffort); // not an eve value
	expect(pickEffort(sonnet, "none")).toBe(sonnet.defaultEffort); // sonnet can't turn it off
	expect(pickEffort(findModel(defaultModelId), "high")).toBeUndefined(); // no effort control
});
