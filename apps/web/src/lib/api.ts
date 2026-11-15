// Typed client for apps/backend (Hono RPC: hono.dev/docs/guides/rpc).
// Every request carries the signed-in user's Neon Auth token as a bearer header.
import type { AppType } from "backend/app";
import { hc } from "hono/client";
import { getToken } from "@/lib/auth-client";

export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = hc<AppType>(API_URL, {
	headers: async () => {
		return { authorization: `Bearer ${(await getToken()) ?? ""}` };
	},
});

/** Tells the sidebar's chat list to reload after a create or delete. */
export const CHATS_CHANGED = "chats-changed";
export const notifyChatsChanged = () =>
	window.dispatchEvent(new Event(CHATS_CHANGED));
