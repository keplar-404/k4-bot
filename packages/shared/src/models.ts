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
	/** false: text only (OpenRouter `input_modalities`); a vision model reads images for it. */
	vision?: false;
	/** The top model: picking it plays the prompt bar's sparkle. */
	flagship?: true;
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
		flagship: true,
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
		id: "z-ai/glm-5.3-prime",
		contextWindow: 1_000_000,
		name: "GLM 5.3 Prime",
		provider: "Z.ai",
		efforts: ["low", "high"],
		defaultEffort: "high",
		vision: false,
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

/** Read images for a text-only model (view_file). The first is the default (free). */
export const visionModels = [
	{ id: "nvidia/nemotron-3.5-super-vl:free", name: "Nemotron 3.5 VL (free)" },
	{ id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)" },
	{ id: "openai/gpt-6-luna", name: "GPT-6 Luna" },
	{ id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
];
export const findVisionModel = (id: unknown) =>
	visionModels.find((m) => m.id === id) ?? visionModels[0];

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

/**
 * Media models for the agent's `media` tool, the first is the
 * default (free when one exists). From OpenRouter's live list (2026-11-21).
 */
export const mediaModels = {
	image: [
		{ id: "recraft/recraft-v4.1-flash-v2:free" },
		{ id: "bytedance-seed/seedream-5-5" },
	],
	// The free HeyGen voice returns raw PCM only, which a browser can't play.
	speech: [
		{
			id: "mistralai/voxtral-mini-tts-3-0",
			voice: "en_paul_neutral",
		},
	],
	transcribe: [{ id: "nvidia/nemotron-3.5-transcribe" }],
	// No free video model exists (GET /api/v1/videos/models, 2026-11-22). wan-3.0 is
	// about $0.05 a second at 480p; the others for when the user asks for quality.
	video: [
		{ id: "alibaba/wan-3.0" },
		{ id: "bytedance/seedance-2.0-mini" },
		{ id: "google/veo-3.1-lite" },
		{ id: "x-ai/grok-imagine-video-1.5-lite" },
	],
	// Lyria: a 30 s clip is $0.04, a full song $0.08 (OpenRouter model pages).
	music: [
		{ id: "google/lyria-3-clip-preview" },
		{ id: "google/lyria-3-pro-preview" },
	],
};

/** The requested media model if allowed, else that kind's default. */
export function pickMediaModel<K extends keyof typeof mediaModels>(
	kind: K,
	id?: string,
): (typeof mediaModels)[K][number] {
	const list: readonly (typeof mediaModels)[K][number][] = mediaModels[kind];
	return list.find((m) => m.id === id) ?? list[0];
}
