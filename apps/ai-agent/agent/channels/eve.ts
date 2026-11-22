import { userFromBearer } from "@repo/shared/auth";
import { findModel, pickEffort } from "@repo/shared/models";
import { overLimit } from "@repo/shared/rate-limit";
import { agentEvent, chat } from "@repo/shared/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { type AuthFn, ForbiddenError, localDev } from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { type SessionStreamEvent, transcriptOf } from "eve/client";
import { sessions } from "eve/server";
import { db } from "../lib/db";
import { assertSessionOwner } from "../lib/owner";

const MODES = ["ask", "plan", "full"] as const;

// A session's owner never changes, so one answer per session is enough. Capped:
// when full, the oldest entry goes (insertion order), as in rate-limit.ts.
const owners = new Map<string, string>();
const MAX_OWNERS = 10_000;

// The user who started a session. Only this agent writes agent_event (hooks/
// persist.ts), with the session starter as user_id, and its primary key starts
// with session_id, so one row answers it. Not `chat`: a browser could save another
// user's session id there. Reading the session stream instead loads every stored
// chunk: seconds on long chats.
async function sessionOwner(sessionId: string): Promise<string | null> {
	const cached = owners.get(sessionId);
	if (cached) return cached;
	const [row] = await db()
		.select({ userId: agentEvent.userId })
		.from(agentEvent)
		.where(
			and(eq(agentEvent.sessionId, sessionId), isNotNull(agentEvent.userId)),
		)
		.limit(1);
	const owner = row?.userId ?? (await ownerFromStream(sessionId));
	if (owner) {
		if (owners.size >= MAX_OWNERS)
			owners.delete(owners.keys().next().value ?? "");
		owners.set(sessionId, owner);
	}
	return owner;
}

// Fallback while a new session has no agent_event row yet: the principal on
// the session's first admitted delivery.
// eve docs: route auth doesn't check who may use a session, so we do.
async function ownerFromStream(sessionId: string): Promise<string | null> {
	const controller = new AbortController();
	try {
		const events = sessions
			.attach(sessionId)
			.stream({ startIndex: 0, follow: false, signal: controller.signal });
		for await (const event of events) {
			if (event.type === "delivery.admitted") {
				return (
					(event.data as { principal?: { id?: string } }).principal?.id ?? null
				);
			}
		}
		return null;
	} finally {
		controller.abort();
	}
}

// The text of a chat's current session, from our agent_event copy: only the
// caller's own chat, and only the event types that hold text (not tool output).
// ponytail: last 50 messages; summarize older ones if long chats lose context.
async function chatHistory(chatId: string, userId: string) {
	if (chatId.length > 100) return undefined;
	const rows = await db()
		.select({
			type: agentEvent.type,
			scope: agentEvent.scope,
			data: agentEvent.data,
			line: agentEvent.line,
			index: agentEvent.index,
		})
		.from(agentEvent)
		.innerJoin(chat, eq(chat.eveSessionId, agentEvent.sessionId))
		.where(
			and(
				eq(chat.id, chatId),
				eq(chat.userId, userId),
				inArray(agentEvent.type, TEXT_EVENTS),
			),
		)
		.orderBy(agentEvent.line, agentEvent.index);
	const events = rows.map((r) => ({
		type: r.type,
		scope: r.scope ?? {},
		data: r.data,
		meta: { position: { line: r.line, index: r.index }, at: "" },
	})) as unknown as SessionStreamEvent[];
	return transcriptOf(events, { maxMessages: 50 }).messages.map((m) => ({
		role: m.role,
		text: m.text,
	}));
}
const TEXT_EVENTS = [
	"delivery.consumed",
	"content.completed",
	"turn.started",
	"turn.settled",
	"context.settled",
	"session.ended",
];

// Browser requests carry the signed-in user's Neon Auth token (Authorization: Bearer).
// It is checked locally against Neon's public keys, then the session must be theirs.
const appSession: AuthFn<Request> = async (request) => {
	const user = await userFromBearer(request.headers.get("authorization"));
	if (!user) return null;

	const sessionId = /\/session\/([^/?]+)/.exec(
		new URL(request.url).pathname,
	)?.[1];
	// Each user has their own counter. Only POSTs (messages, approvals) count;
	// reads and stream reconnects are free. Runs alongside the owner check.
	const [, limited] = await Promise.all([
		sessionId && assertSessionOwner(() => sessionOwner(sessionId), user.id),
		request.method === "POST" &&
			overLimit(db(), `agent:${user.id}`, 60, 60_000),
	]);
	if (limited) {
		throw new ForbiddenError({
			code: "rate_limited",
			message: "Too many messages. Wait a minute and try again.",
		});
	}
	return {
		authenticator: "neon-auth",
		principalId: user.id,
		principalType: "user",
		attributes: {},
	};
};

export default eveChannel({
	// No vercelOidc(): the agent is self-hosted (eve docs: omit it on non-Vercel hosts).
	auth: [appSession, localDev()],
	// The web app sends { model, reasoning, mode } as clientContext. Validate it and
	// hand it to agent.ts (model, approval policy) through the turn's auth.
	async onMessage(ctx) {
		const auth = defaultEveAuth(ctx);
		const sent = ctx.eve.clientContext;
		if (!auth || !sent || typeof sent !== "object" || Array.isArray(sent)) {
			return { auth };
		}
		const {
			model: modelId,
			reasoning,
			mode,
			reseed,
			...rest
		} = sent as Record<string, unknown>;
		// A new session for a chat whose old session ended or is gone: the model
		// gets the old conversation back (eve docs: Start from prior history).
		const history =
			!ctx.eve.sessionId && typeof reseed === "string" && auth.principalId
				? await chatHistory(reseed, auth.principalId)
				: undefined;
		const model = findModel(modelId);
		const effort = pickEffort(model, reasoning);
		const safeMode = MODES.find((m) => m === mode) ?? "ask";
		return {
			auth: {
				...auth,
				attributes: {
					...auth.attributes,
					model: model.id,
					mode: safeMode,
					...(effort ? { reasoning: effort } : {}),
				},
			},
			// The model still sees the mode, so it can explain what it may do.
			clientContext: JSON.stringify({ mode: safeMode, ...rest }),
			...(history?.length ? { history } : {}),
		};
	},
});
