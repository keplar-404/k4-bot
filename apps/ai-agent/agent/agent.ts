import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { findModel, pickEffort } from "@repo/shared/models";
import { defineAgent, defineDynamic } from "eve";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

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
	// Plan: web search only. Ask and Full: no tool here changes anything, so no prompts.
	approval: ({ session, toolName }) => {
		// A request with no valid mode counts as Ask, never as Full.
		const sent = session.auth.current?.attributes.mode;
		const mode = typeof sent === "string" && MODES.has(sent) ? sent : "ask";
		if (mode === "plan" && toolName !== "web_search") {
			return { type: "denied", reason: "Plan mode only allows web_search." };
		}
		return undefined;
	},
	// eve docs, Workflow worlds: sessions and every event (including tool input and
	// output) are stored in Postgres in dev and production, so a chat opens from any
	// machine. Needs WORKFLOW_POSTGRES_URL (a direct, unpooled Neon URL) and
	// `bun run workflow:bootstrap` once.
	// No 30-day idle timeout: an ended session's history is deleted (private sessions
	// use zero retention outside dev), so old chats would open empty. Deleting a chat
	// still ends its session and deletes its history.
	limits: {
		sessionTimeoutMs: false,
		// Budget prompt (eve docs: agent-config > Runtime limits): the user is asked to
		// Continue or Stop at 200k new input tokens, then at 400k, 800k and so on.
		// shortcut: per chat, not per user per day; add a per-user spend limit before launch.
		sessionUsage: ({ total, window }) => {
			const used = total.inputTokens - total.cacheReadTokens;
			const approvedAt = used - (window.inputTokens - window.cacheReadTokens);
			let next = 200_000;
			while (next <= approvedAt) next *= 2;
			return used >= next;
		},
	},
	experimental: { workflow: { world: "@workflow/world-postgres" } },
});
