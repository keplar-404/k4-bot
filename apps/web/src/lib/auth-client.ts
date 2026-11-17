"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to this app's own /api/auth proxy (see app/api/auth/[...path]).
export const authClient = createAuthClient();

/** The signed-in user's token for our backend and the agent, or undefined when signed out. */
export async function getToken() {
	try {
		const { data } = await authClient.token();
		if (data?.token) return data.token;
	} catch {}
	// The session cookie is still there but Neon Auth refused it (expired, or the
	// user was deleted): sign in again instead of failing every request.
	if (window.location.pathname !== "/login") window.location.assign("/login");
	return undefined;
}
