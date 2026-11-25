// The signed-in user's cloud computer, for the computer_* tools. One computer per
// user; each chat's agent works as its own Linux user on its own desktop there
// (@repo/shared/computer). E2B loads only when a computer tool runs.
import { runOnComputer } from "@repo/shared/computer";
import { appUserId, db } from "./db";

type Ctx = {
	session: { id: string; auth: { current: Parameters<typeof appUserId>[0] } };
};

// Desktop steps share one screen and one state file per agent, so they run one at a
// time (Cua: "keep one controller for a shared desktop"). The 30 s wait plus a
// step's 90 s stays under the tools' 120 s timeout.
export const oneAtATime = (command: string) =>
	`flock -w 30 -E 75 /tmp/k4-app-$USER.lock ${command} || { s=$?; [ $s = 75 ] && echo "Another desktop step of yours is still running. Try again in a moment." >&2; exit $s; }`;

export function onComputer(
	ctx: Ctx,
	command: string,
	opts?: Parameters<typeof runOnComputer>[4],
) {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId) throw new Error("Sign in to use your computer.");
	return runOnComputer(db(), userId, ctx.session.id, command, opts);
}
