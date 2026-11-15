import { findModel, pickEffort } from "@repo/shared/models";
import { type AuthFn, ForbiddenError, localDev } from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { sessions } from "eve/server";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8787";
const MODES = ["ask", "plan", "full"] as const;

// The user who started a session: the principal on its first admitted delivery.
// eve docs: route auth doesn't check who may use a session, so we do.
async function sessionOwner(sessionId: string): Promise<string | null> {
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

// Browser requests carry the Better Auth cookie set by apps/backend.
// Ask the backend who it belongs to, then check the session is theirs.
const appSession: AuthFn<Request> = async (request) => {
	const cookie = request.headers.get("cookie");
	if (!cookie) return null;
	const res = await fetch(`${backendUrl}/api/auth/get-session`, {
		headers: { cookie },
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { user?: { id: string } } | null;
	if (!data?.user) return null;

	const sessionId = /\/session\/([^/?]+)/.exec(
		new URL(request.url).pathname,
	)?.[1];
	if (sessionId) {
		const owner = await sessionOwner(sessionId).catch(() => null);
		if (owner !== null && owner !== data.user.id) {
			throw new ForbiddenError({
				message: "This conversation belongs to another user.",
			});
		}
	}
	return {
		authenticator: "better-auth",
		principalId: data.user.id,
		principalType: "user",
		attributes: {},
	};
};

export default eveChannel({
	// No vercelOidc(): the agent is self-hosted (eve docs: omit it on non-Vercel hosts).
	auth: [appSession, localDev()],
	// The web app sends { model, reasoning, mode } as clientContext. Validate it and
	// hand it to agent.ts (model, approval policy) through the turn's auth.
	onMessage(ctx) {
		const auth = defaultEveAuth(ctx);
		const sent = ctx.eve.clientContext;
		if (!auth || !sent || typeof sent !== "object" || Array.isArray(sent)) {
			return { auth };
		}
		const {
			model: modelId,
			reasoning,
			mode,
			...rest
		} = sent as Record<string, unknown>;
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
		};
	},
});
