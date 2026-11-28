import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { findModel, pickEffort } from "@repo/shared/models";
import {
	decryptKey,
	parseRef,
	providerModels,
	resolveModel,
} from "@repo/shared/providers";
import { userProviderKey } from "@repo/shared/schema";
import { and, eq } from "drizzle-orm";
import { defineAgent, defineDynamic } from "eve";
import { appUserId, db } from "./lib/db";
import { helperSlot } from "./lib/helpers";
import { modeOf } from "./lib/mode";
import { userModel } from "./lib/providers";
import { routineGate } from "./lib/routine";

/** The user's saved credentials for a provider (secrets still sealed), or null. */
async function savedCreds(userId: string, provider: string) {
	const [row] = await db()
		.select({ sealed: userProviderKey.sealed, config: userProviderKey.config })
		.from(userProviderKey)
		.where(
			and(
				eq(userProviderKey.userId, userId),
				eq(userProviderKey.provider, provider),
			),
		);
	return row ?? null;
}

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Plan mode reads the web only; lib/mode.ts hides every other tool from the model.
// ask_question changes nothing, and eve's built-in workflow tools must stay static.
// Skill tools only read the user's skills (R2), so Plan mode keeps them.
const PLAN_TOOLS = new Set([
	"web_search",
	"web_fetch",
	"ask_question",
	"find_skill",
	"load_skill",
	"read_skill_file",
	"search_skill",
	"time", // pure date math and arithmetic, no I/O
	"calculate",
]);
// Tools that change something: Ask mode confirms each call.
const WRITE_TOOLS = new Set([
	"browser",
	"app",
	"share_file",
	"download_file",
	"delete_file",
	"media",
	"video",
	"use_connector", // the user's own MCP servers: any tool may write
]);

export default defineAgent({
	// The web picker's choice arrives as auth attributes set in channels/eve.ts.
	// Pure reads, no I/O, so no memo is needed.
	model: defineDynamic(async (ctx) => {
		const attrs = ctx.session.auth.current?.attributes ?? {};
		// A model on the user's own key (Settings > Model providers).
		const own = parseRef(attrs.model);
		if (own) {
			const userId = appUserId(ctx.session.auth.current);
			if (!userId) throw new Error("Sign in to use your own providers.");
			// eve saves memo results with the session: keep only the sealed secrets
			// there, and decrypt on each call (eve docs: Dynamic configuration > Memo rules).
			const saved = await ctx.memo(
				["provider-key", own.provider.id, ctx.turn?.id ?? null],
				() => savedCreds(userId, own.provider.id),
			);
			if (!saved)
				throw new Error(
					`Add your ${own.provider.name} details in Settings > Model providers.`,
				);
			// Custom endpoints and Azure: only the model names the user saved.
			const model = providerModels(own.provider, saved.config).find(
				(m) => m.id === own.model.id,
			);
			if (!model)
				throw new Error(
					`${own.model.id} isn't one of your ${own.provider.name} models.`,
				);
			return {
				model: await userModel(own.provider, model, {
					secret: JSON.parse(decryptKey(userId, own.provider.id, saved.sealed)),
					config: saved.config,
				}),
				reasoning:
					pickEffort(resolveModel(attrs.model), attrs.reasoning) ??
					"provider-default",
				modelContextWindowTokens: model.contextWindow,
			};
		}
		const model = findModel(attrs.model);
		return {
			model: openrouter(model.id, {
				// OpenRouter docs (prompt caching): Claude caches only with a top-level
				// cache_control (5 min, renewed on every hit); other providers cache on
				// their own. session_id keeps a chat on one provider so its cache stays warm.
				...(model.id.startsWith("anthropic/")
					? { cache_control: { type: "ephemeral" as const } }
					: {}),
				extraBody: { session_id: ctx.session.id },
			}),
			reasoning: pickEffort(model, attrs.reasoning) ?? "provider-default",
			// OpenRouter models are not in the AI Gateway catalog, so eve needs the window.
			modelContextWindowTokens: model.contextWindow,
		};
	}),
	// eve docs, Human in the Loop > "Gate every call from one policy".
	// Ask: confirm every write. Full: no prompts here (memory writes ask through their
	// own approval). Plan: tools are already hidden; this denial is the backstop.
	approval: async (ctx) => {
		const { session, toolName } = ctx;
		// Routines plug-in: unattended runs save sends/posts/merges as drafts instead.
		const gate = await routineGate(ctx);
		if (gate) return gate;
		const mode = modeOf(session);
		if (
			mode === "plan" &&
			!PLAN_TOOLS.has(toolName) &&
			!toolName.startsWith("eve__")
		) {
			return { type: "denied", reason: "Plan mode only reads the web." };
		}
		if (toolName === "agent") {
			const full = helperSlot(ctx.callId);
			if (full) return { type: "denied", reason: full };
		}
		if (
			mode === "ask" &&
			(toolName.startsWith("computer_") ||
				WRITE_TOOLS.has(toolName) ||
				// eve names connection tools `<connection>__<tool>` (docs: connections/mcp).
				toolName.endsWith("COMPOSIO_MULTI_EXECUTE_TOOL"))
		)
			return "user-approval";
		return undefined;
	},
	// No Workflow world set (eve docs, Workflow worlds): `eve dev` keeps runs in local
	// files (.eve/), and Vercel uses Vercel Workflow. The Postgres world on Neon polled
	// and re-read every stream chunk over the internet, using up Neon's network transfer.
	// A chat's session ends after 7 idle days and the World deletes its run data
	// (retention 0, set explicitly rather than using the World's default). Old chats
	// still open from agent_event, and the next message starts a new session seeded
	// with the conversation (channels/eve.ts).
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
