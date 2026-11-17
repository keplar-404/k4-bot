"use client";

import { useEffect } from "react";
import { claimChatCache } from "@/lib/chat-cache";

// Another user's cached chats never show here: a different signed-in user wipes them.
export function ChatCacheOwner({ userId }: { userId: string }) {
	useEffect(() => {
		void claimChatCache(userId);
	}, [userId]);
	return null;
}
