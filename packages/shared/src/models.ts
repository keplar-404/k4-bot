// Shared by the agent (allowlist) and the web model picker.
// Ids and reasoning efforts come from https://openrouter.ai/api/v1/models
// (`reasoning.supported_efforts`), limited to the values eve accepts.
// ponytail: static list; fetch the OpenRouter catalog if it must stay live.

export type Effort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ModelOption = {
	id: string;
	name: string;
	provider: string;
	/** Empty: the model has no effort control. */
	efforts: Effort[];
	defaultEffort?: Effort;
	/** Tokens eve compacts against (OpenRouter `context_length`). */
	contextWindow: number;
};

export const models: ModelOption[] = [
	{
		id: "openrouter/free",
		// Routes to many models, some smaller than the listed 200k: stay conservative.
		contextWindow: 128_000,
		name: "Free router",
		provider: "OpenRouter",
		efforts: [],
	},
	{
		id: "anthropic/claude-sonnet-5.5",
		contextWindow: 1_000_000,
		name: "Claude Sonnet 5.5",
		provider: "Anthropic",
		efforts: ["low", "medium", "high", "xhigh"],
		defaultEffort: "high",
	},
	{
		id: "anthropic/claude-haiku-5.5",
		contextWindow: 1_000_000,
		name: "Claude Haiku 5.5",
		provider: "Anthropic",
		efforts: ["none", "low", "medium", "high", "xhigh"],
		defaultEffort: "medium",
	},
	{
		id: "openai/gpt-6.1-sol",
		contextWindow: 1_050_000,
		name: "GPT-6.1 Sol",
		provider: "OpenAI",
		efforts: ["low", "medium", "high", "xhigh"],
		defaultEffort: "medium",
	},
	{
		id: "openai/gpt-6-luna",
		contextWindow: 1_050_000,
		name: "GPT-6 Luna",
		provider: "OpenAI",
		efforts: ["none", "low", "medium", "high", "xhigh"],
		defaultEffort: "medium",
	},
	{
		id: "google/gemini-3.8-flash",
		contextWindow: 1_048_576,
		name: "Gemini 3.8 Flash",
		provider: "Google",
		efforts: ["low", "medium", "high"],
		defaultEffort: "medium",
	},
	{
		id: "deepseek/deepseek-v4.1-flash",
		contextWindow: 1_048_576,
		name: "DeepSeek V4.1 Flash",
		provider: "DeepSeek",
		efforts: ["none", "low", "high"],
		defaultEffort: "high",
	},
];

export const defaultModelId = models[0].id;

export function findModel(id: unknown): ModelOption {
	return models.find((m) => m.id === id) ?? models[0];
}

/** The effort to use: the requested one if this model supports it, else its default. */
export function pickEffort(
	model: ModelOption,
	effort: unknown,
): Effort | undefined {
	return model.efforts.find((e) => e === effort) ?? model.defaultEffort;
}
