import { openUserDesktop } from "@repo/shared/desktop";
import { appUserId, sql } from "./db";

type Auth = { authenticator: string; principalId: string } | null | undefined;

/** The id of the signed-in user's one desktop. Throws if it is not set up yet. */
export async function userDesktopId(auth: Auth) {
	const userId = appUserId(auth);
	if (!userId)
		throw new Error("The computer is only available to signed-in users.");
	const [row] = (await sql()`
		select sandbox_id from user_desktop where user_id = ${userId}`) as {
		sandbox_id: string;
	}[];
	// The backend creates it after sign-in (POST /api/me/desktop). The agent never creates a desktop.
	if (!row)
		throw new Error(
			"Your computer is not ready yet. Reload the dashboard to set it up, then try again.",
		);
	return { userId, sandboxId: row.sandbox_id };
}

// The signed-in user's own desktop. The user comes from the session's verified
// auth (set by channels/eve.ts), never from the model's tool input.
export async function getUserDesktop(auth: Auth) {
	const { userId, sandboxId } = await userDesktopId(auth);
	return { userId, ...(await openUserDesktop(sandboxId)) };
}
