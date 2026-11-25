import { expect, test } from "bun:test";
import {
	defaultModelId,
	findModel,
	pickEffort,
	pickMediaModel,
} from "./models";

// The allowlist is a cost/security check: the browser picks the model.
test("unknown model falls back to the free default", () => {
	expect(findModel("openai/some-expensive-model").id).toBe(defaultModelId);
	expect(findModel(undefined).id).toBe(defaultModelId);
});

// eve compacts at this size; a missing or tiny value would throw history away.
test("every model has a real context window", () => {
	expect(findModel(defaultModelId).contextWindow).toBe(128_000);
	expect(findModel("anthropic/claude-sonnet-5.5").contextWindow).toBe(
		1_000_000,
	);
});

test("effort must be one the model supports", () => {
	const sonnet = findModel("anthropic/claude-sonnet-5.5");
	expect(pickEffort(sonnet, "low")).toBe("low");
	expect(pickEffort(sonnet, "max")).toBe(sonnet.defaultEffort); // not an eve value
	expect(pickEffort(sonnet, "none")).toBe(sonnet.defaultEffort); // sonnet can't turn it off
	expect(pickEffort(findModel(defaultModelId), "high")).toBeUndefined(); // no effort control
});

test("media tools only use allowlisted models, free first", () => {
	expect(pickMediaModel("image").id).toEndWith(":free");
	expect(pickMediaModel("image", "openai/something-expensive").id).toEndWith(
		":free",
	);
	expect(pickMediaModel("image", "bytedance-seed/seedream-5-5").id).toBe(
		"bytedance-seed/seedream-5-5",
	);
});
