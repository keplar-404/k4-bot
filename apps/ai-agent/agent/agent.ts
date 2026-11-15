import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { findModel, pickEffort } from "@repo/shared/models";
import { defineAgent, defineDynamic } from "eve";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Tools that change things or drive the user's computer: ask first in Ask mode.
const SERIOUS = new Set(["computer", "bash", "write_file", "edit_file"]);
const MODES = new Set(["ask", "plan", "full"]);

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
		// A request with no valid mode counts as Ask, never as Full.
		const sent = session.auth.current?.attributes.mode;
		const mode = typeof sent === "string" && MODES.has(sent) ? sent : "ask";
		if (mode === "plan" && toolName !== "web_search") {
			return { type: "denied", reason: "Plan mode only allows web_search." };
		}
		if (mode === "ask" && SERIOUS.has(toolName)) return "user-approval";
		return undefined;
	},
	// No usage cap for now.
	// TODO(later): per-user daily spend limit for paid models. Count tokens per user
	// in the database and refuse new messages over the limit (channels/eve.ts is
	// the place), instead of a per-session `limits.sessionUsage` cap.
	// eve docs, Workflow worlds: sessions and every event (including tool input and
	// output) are stored in Postgres in dev and production, so a chat opens from any
	// machine. Needs WORKFLOW_POSTGRES_URL (a direct, unpooled Neon URL) and
	// `bun run workflow:bootstrap` once.
	experimental: { workflow: { world: "@workflow/world-postgres" } },
});
