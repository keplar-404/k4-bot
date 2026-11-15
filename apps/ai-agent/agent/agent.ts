import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { findModel, pickEffort } from "@repo/shared/models";
import { defineAgent, defineDynamic } from "eve";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Tools that change things or drive the user's computer: ask first in Ask mode.
const SERIOUS = new Set(["computer", "bash", "write_file", "edit_file"]);

export default defineAgent({
	// The web picker's choice arrives as auth attributes set in channels/eve.ts.
	// Pure reads, no I/O, so no memo is needed.
	model: defineDynamic((ctx) => {
		const attrs = ctx.session.auth.current?.attributes ?? {};
		const model = findModel(attrs.model);
		return {
			model: openrouter(model.id),
			reasoning: pickEffort(model, attrs.reasoning) ?? "provider-default",
			// OpenRouter models are not in the AI Gateway catalog; stay conservative.
			modelContextWindowTokens: 128_000,
		};
	}),
	// eve docs, Human in the Loop > "Gate every call from one policy".
	// Plan: web search only. Ask: approve serious tools. Full: no prompts.
	approval: ({ session, toolName }) => {
		const mode = session.auth.current?.attributes.mode;
		if (mode === "plan" && toolName !== "web_search") {
			return { type: "denied", reason: "Plan mode only allows web_search." };
		}
		if (mode === "ask" && SERIOUS.has(toolName)) return "user-approval";
		return undefined;
	},
	limits: {
		// eve docs, Runtime limits. OpenRouter reports no costUsd, so cap tokens.
		// shortcut: per-session cap only; add a per-user monthly quota for billing.
		sessionUsage: ({ window }) =>
			window.inputTokens - window.cacheReadTokens >= 2_000_000 ||
			window.outputTokens >= 200_000,
	},
	// eve docs, Workflow worlds: checkpoints and runs in Postgres (Neon) when
	// WORKFLOW_POSTGRES_URL is set (production `eve start`). `eve dev` uses local files.
	...(process.env.WORKFLOW_POSTGRES_URL
		? { experimental: { workflow: { world: "@workflow/world-postgres" } } }
		: {}),
});
