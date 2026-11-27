// Is this session a routine run? (Routines plug-in.) Runs started by the browser save
// their session id before the first message; scheduled runs carry `routineRun` in their
// auth until the hook saves it. Asked by tools, instructions and the approval gate, so
// answers are kept for a minute per session.
import {
	needsUser,
	runById,
	runOfSession,
	slugsIn,
} from "@repo/shared/routines";
import { appUserId, db } from "./db";

type Session = {
	id: string;
	auth: {
		current?: {
			authenticator: string;
			principalId: string;
			attributes: Record<string, unknown>;
		} | null;
	};
};
type Run = Awaited<ReturnType<typeof runOfSession>> | null;

const TTL = 60_000;
const MAX = 2_000;
const seen = new Map<string, { at: number; run: Run }>();

export async function routineRunOf(session: Session): Promise<Run> {
	const hit = seen.get(session.id);
	if (hit && Date.now() - hit.at < TTL) return hit.run;
	const userId = appUserId(session.auth.current);
	if (!userId) return null;
	const runId = session.auth.current?.attributes.routineRun;
	const run =
		(typeof runId === "string" ? await runById(db(), runId, userId) : null) ??
		(await runOfSession(db(), session.id));
	// Only the user's own run: a session id can't point at someone else's routine.
	// Plain JSON (dates as strings): eve's ctx.memo only keeps JSON values.
	const own: Run =
		run && run.run.userId === userId ? JSON.parse(JSON.stringify(run)) : null;
	if (seen.size >= MAX) seen.delete(seen.keys().next().value ?? "");
	seen.set(session.id, { at: Date.now(), run: own });
	return own;
}

/** Forget a cached answer (after the run's notes change). */
export const forgetRoutineRun = (sessionId: string) => seen.delete(sessionId);

/**
 * In routine runs, app actions that send, post, merge or delete never run on their own:
 * the model is told to save a draft with request_approval. Undefined: not a routine run,
 * or nothing to block. Browser and desktop steps can't be inspected here; the routine
 * instructions cover them.
 */
export async function routineGate(ctx: {
	session: Session;
	toolName: string;
	toolInput?: unknown;
}) {
	const gated =
		ctx.toolName.endsWith("COMPOSIO_MULTI_EXECUTE_TOOL") ||
		ctx.toolName === "use_connector";
	if (!gated) return undefined;
	const blocked = slugsIn(ctx.toolInput).filter(needsUser);
	if (!blocked.length || !(await routineRunOf(ctx.session))) return undefined;
	return {
		type: "denied" as const,
		reason: `This is an unattended routine run: ${blocked.join(", ")} needs the user. Call request_approval with this exact tool and arguments instead.`,
	};
}
