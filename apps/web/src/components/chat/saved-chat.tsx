"use client";

import type { ClientSessionState } from "eve/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat/chat";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";
import {
	checkChat,
	clearChatChecks,
	dropCachedChat,
	getCachedChat,
	lastLine,
} from "@/lib/chat-cache";

type Saved = {
	sessionId: string | null;
	session?: ClientSessionState;
	events: unknown[];
};

// A saved chat. Cached in this browser: shown at once, and the backend is asked only
// for events after the cached ones (none for an unchanged chat), which still checks
// that the chat exists and is this user's. Not cached: ChatSkeleton until it loads.
export function SavedChat({ id }: { id: string }) {
	const router = useRouter();
	const [saved, setSaved] = useState<Saved>();
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let live = true;
		(async () => {
			const cached = await getCachedChat(id);
			if (cached && live)
				setSaved({
					sessionId: cached.session.sessionId,
					session: cached.session,
					events: cached.events,
				});
			const res = await checkChat(
				id,
				cached ? lastLine(cached.events) : undefined,
			);
			// Missing, or another user's chat: back to a new chat, which shows a toast.
			if (res.status === 404) {
				clearChatChecks();
				await dropCachedChat(id);
				return router.replace("/dashboard/chat?notfound=1");
			}
			const { body } = res;
			if (!("chat" in body)) throw new Error("Could not load the chat");
			const sid = body.chat.eveSessionId;
			if (cached && (!sid || cached.session.sessionId === sid)) {
				// Same session: add the turns made since (another tab or device), if any.
				if (body.events.length && live)
					setSaved({
						sessionId: sid,
						events: [...cached.events, ...body.events],
					});
				return;
			}
			// No cache, or the chat moved on to a new session elsewhere.
			let { events } = body;
			// The cache's `after` cut the new session's events short: read them all.
			if (cached) {
				const { body: full } = await checkChat(id);
				if (!("chat" in full)) throw new Error("Could not load the chat");
				events = full.events;
			}
			if (live) setSaved({ sessionId: body.chat.eveSessionId, events });
		})().catch(() => live && setFailed(true));
		return () => {
			live = false;
		};
	}, [id, router]);

	if (failed && !saved) throw new Error("Could not load the chat");
	if (!saved) return <ChatSkeleton />;
	return (
		<Chat
			key={`${saved.sessionId}:${saved.events.length}`}
			chatId={id}
			sessionId={saved.sessionId}
			session={saved.session}
			events={saved.events}
		/>
	);
}
