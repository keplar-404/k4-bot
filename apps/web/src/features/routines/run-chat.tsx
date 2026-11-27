"use client";

// Routines plug-in: a run's chat is a normal saved chat, plus the Edit routine tab.
import { SavedChat } from "@/components/chat/saved-chat";
import { useEditRoutine } from "./edit-panel";

export function RunChat({
	routineId,
	chatId,
}: {
	routineId: string;
	chatId: string;
}) {
	useEditRoutine(routineId);
	return <SavedChat id={chatId} />;
}
