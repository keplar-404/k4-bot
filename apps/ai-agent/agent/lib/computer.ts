// The signed-in user's cloud computer, for the computer_* tools. One computer per
// user; each chat's agent works as its own Linux user on its own desktop there
// (@repo/shared/computer). E2B loads only when a computer tool runs.
import { runOnComputer } from "@repo/shared/computer";
import { appUserId, db } from "./db";

type Ctx = {
	session: { id: string; auth: { current: Parameters<typeof appUserId>[0] } };
};

export function onComputer(
	ctx: Ctx,
	command: string,
	opts?: Parameters<typeof runOnComputer>[4],
) {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId) throw new Error("Sign in to use your computer.");
	return runOnComputer(db(), userId, ctx.session.id, command, opts);
}
