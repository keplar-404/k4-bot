"use client";

import type { ClientSessionState } from "eve/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat/chat";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";
import { api } from "@/lib/api";
import { dropCachedChat, getCachedChat, lastLine } from "@/lib/chat-cache";

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
			const res = await api.api.chats[":id"].$get({
				param: { id },
				query: cached ? { after: String(lastLine(cached.events)) } : {},
			});
			// Missing, or another user's chat: back to a new chat, which shows a toast.
			if (res.status === 404) {
				await dropCachedChat(id);
				return router.replace("/dashboard/chat?notfound=1");
			}
			const body = await res.json();
			if (!("chat" in body)) throw new Error("Could not load the chat");
			// With a cache, eve's resume brings any newer turns itself.
			if (!cached && live)
				setSaved({ sessionId: body.chat.eveSessionId, events: body.events });
		})().catch(() => live && setFailed(true));
		return () => {
			live = false;
		};
	}, [id, router]);

	if (failed && !saved) throw new Error("Could not load the chat");
	if (!saved) return <ChatSkeleton />;
	return (
		<Chat
			chatId={id}
			sessionId={saved.sessionId}
			session={saved.session}
			events={saved.events}
		/>
	);
}
