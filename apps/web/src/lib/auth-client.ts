"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to this app's own /api/auth proxy (see app/api/auth/[...path]).
export const authClient = createAuthClient();

// The token is a short-lived JWT: reuse it until a minute before it expires instead
// of asking /api/auth/token on every API call. Concurrent callers share one refresh.
let cached: { token: string; exp: number } | undefined;
let refreshing: Promise<string | undefined> | undefined;

const expiresAt = (token: string) => {
	try {
		const payload = JSON.parse(
			atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
		) as { exp?: number };
		return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
	} catch {
		return 0; // unreadable: don't cache it
	}
};

/** Drops the cached token (sign-out, or the backend refused it). */
export function forgetToken() {
	cached = undefined;
}

/** The signed-in user's token for our backend and the agent, or undefined when signed out. */
export async function getToken() {
	if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
	refreshing ??= (async () => {
		try {
			const { data } = await authClient.token();
			if (data?.token) {
				cached = { token: data.token, exp: expiresAt(data.token) };
				return data.token;
			}
		} catch {}
		cached = undefined;
		// The session cookie is still there but Neon Auth refused it (expired, or the
		// user was deleted): sign in again instead of failing every request.
		if (window.location.pathname !== "/login") window.location.assign("/login");
		return undefined;
	})().finally(() => {
		refreshing = undefined;
	});
	return refreshing;
}
