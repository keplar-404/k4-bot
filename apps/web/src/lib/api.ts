// Typed client for apps/backend (Hono RPC: hono.dev/docs/guides/rpc).
// credentials: "include" sends the Better Auth cookie with every request.
import type { AppType } from "backend/app";
import { hc } from "hono/client";

export const api = hc<AppType>(
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
	{ init: { credentials: "include" } },
);

/** Tells the sidebar's chat list to reload after a create or delete. */
export const CHATS_CHANGED = "chats-changed";
export const notifyChatsChanged = () =>
	window.dispatchEvent(new Event(CHATS_CHANGED));
