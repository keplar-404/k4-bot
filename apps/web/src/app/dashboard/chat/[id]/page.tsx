import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Chat } from "@/components/chat/chat";

// Reads params and the request cookie, so it renders inside <Suspense>
// (Cache Components: forward the params promise, await it in the child).
async function SavedChat({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/api/chats/${encodeURIComponent(id)}`,
		{
			headers: { cookie: (await headers()).get("cookie") ?? "" },
			cache: "no-store",
		},
	);
	if (!res.ok) notFound(); // missing, or another user's chat
	const { chat } = (await res.json()) as {
		chat: { id: string; eveSessionId: string | null };
	};
	return <Chat key={chat.id} chatId={chat.id} sessionId={chat.eveSessionId} />;
}

export default function ChatPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return (
		<Suspense>
			<SavedChat params={params} />
		</Suspense>
	);
}
