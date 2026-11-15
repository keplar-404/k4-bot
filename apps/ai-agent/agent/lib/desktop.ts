import { createUserDesktop, openUserDesktop } from "@repo/shared/desktop";
import { appUserId, sql } from "./db";

type Auth = { authenticator: string; principalId: string } | null | undefined;

// The signed-in user's own desktop. The user comes from the session's verified
// auth (set by channels/eve.ts), never from the model's tool input.
export async function getUserDesktop(auth: Auth) {
	const userId = appUserId(auth);
	if (!userId)
		throw new Error("The computer is only available to signed-in users.");
	let [row] = (await sql()`
		select sandbox_id from user_desktop where user_id = ${userId}`) as {
		sandbox_id: string;
	}[];
	if (!row) {
		// Created at sign-up; this covers users from before that, or a failed create.
		const sandboxId = await createUserDesktop(userId);
		await sql()`
			insert into user_desktop (user_id, sandbox_id) values (${userId}, ${sandboxId})
			on conflict (user_id) do nothing`;
		[row] = (await sql()`
			select sandbox_id from user_desktop where user_id = ${userId}`) as {
			sandbox_id: string;
		}[];
	}
	return openUserDesktop(row.sandbox_id);
}
