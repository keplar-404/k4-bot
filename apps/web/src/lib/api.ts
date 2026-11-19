// Typed client for apps/backend (Hono RPC: hono.dev/docs/guides/rpc).
// Every request carries the signed-in user's Neon Auth token as a bearer header.
import type { AppType } from "backend/app";
import { hc } from "hono/client";
import { forgetToken, getToken } from "@/lib/auth-client";

export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = hc<AppType>(API_URL, {
	// The token is cached (auth-client.ts); a 401 means it went stale early, so drop it
	// and retry once with a fresh one. Bodies here are JSON strings, safe to resend.
	fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
		const call = async () => {
			const headers = new Headers(init?.headers);
			headers.set("authorization", `Bearer ${(await getToken()) ?? ""}`);
			return fetch(input, { ...init, headers });
		};
		const res = await call();
		if (res.status !== 401) return res;
		forgetToken();
		return call();
	},
});

/** Tells the sidebar's chat list to reload after a create or delete. */
export const CHATS_CHANGED = "chats-changed";
export const notifyChatsChanged = () =>
	window.dispatchEvent(new Event(CHATS_CHANGED));
