import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { findModel, pickEffort } from "@repo/shared/models";
import { defineAgent, defineDynamic } from "eve";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const MODES = new Set(["ask", "plan", "full"]);
// The simple computer tools (tools/browser.ts, tools/app.ts): gated like computer_*.
const COMPUTER_TOOLS = new Set(["browser", "app"]);

export default defineAgent({
	// The web picker's choice arrives as auth attributes set in channels/eve.ts.
	// Pure reads, no I/O, so no memo is needed.
	model: defineDynamic((ctx) => {
		const attrs = ctx.session.auth.current?.attributes ?? {};
		const model = findModel(attrs.model);
		return {
			model: openrouter(model.id),
			reasoning: pickEffort(model, attrs.reasoning) ?? "provider-default",
			// OpenRouter models are not in the AI Gateway catalog, so eve needs the window.
			modelContextWindowTokens: model.contextWindow,
		};
	}),
	// eve docs, Human in the Loop > "Gate every call from one policy".
	// Plan: web search only. Ask and Full: no prompts here (memory writes ask through
	// their own approval). shortcut: Ask doesn't gate Composio actions yet.
	approval: ({ session, toolName }) => {
		// A request with no valid mode counts as Ask, never as Full.
		const sent = session.auth.current?.attributes.mode;
		const mode = typeof sent === "string" && MODES.has(sent) ? sent : "ask";
		if (mode === "plan" && toolName !== "web_search") {
			return { type: "denied", reason: "Plan mode only allows web_search." };
		}
		// The user's computer holds their files and logins: Ask mode confirms each action.
		if (
			mode === "ask" &&
			(toolName.startsWith("computer_") || COMPUTER_TOOLS.has(toolName))
		)
			return "user-approval";
		return undefined;
	},
	// No Workflow world set (eve docs, Workflow worlds): `eve dev` keeps runs in local
	// files (.eve/), and Vercel uses Vercel Workflow. The Postgres world on Neon polled
	// and re-read every stream chunk over the internet, using up Neon's network transfer.
	// A chat's session ends after 7 idle days and the World deletes its run data
	// (retention 0; set explicitly, because the Sentry trace policy keeps content and
	// would otherwise keep the World's default). Old chats still open from
	// agent_event, and the next message starts a new session seeded with the
	// conversation (channels/eve.ts). Sentry traces are not deleted.
	experimental: { workflow: { retention: 0 } },
	limits: {
		sessionTimeoutMs: 7 * 24 * 60 * 60_000,
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
});
