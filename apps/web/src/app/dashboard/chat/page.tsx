import { Suspense } from "react";
import { Chat } from "@/components/chat/chat";
import { ChatNotFoundToast } from "@/components/chat/chat-not-found-toast";

export default function ChatPage() {
	return (
		<>
			<Suspense>
				<ChatNotFoundToast />
			</Suspense>
			<Chat />
		</>
	);
}
