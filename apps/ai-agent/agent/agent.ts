import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export default defineAgent({
	model: openrouter("openrouter/free"),
	// Not in the AI Gateway catalog; the router serves up to 200K, so stay conservative.
	modelContextWindowTokens: 128_000,
});
