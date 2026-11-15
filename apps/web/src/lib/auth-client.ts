"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to this app's own /api/auth proxy (see app/api/auth/[...path]).
export const authClient = createAuthClient();

/** The signed-in user's token for our backend and the agent, or undefined when signed out. */
export async function getToken() {
	const { data } = await authClient.token();
	return data?.token;
}
