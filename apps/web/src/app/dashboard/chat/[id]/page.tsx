import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Chat } from "@/components/chat/chat";
import { auth } from "@/lib/auth/server";

// Reads params and the signed-in user, so it renders inside <Suspense>
// (Cache Components: forward the params promise, await it in the child).
async function SavedChat({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	// The SDK's server `auth` types `token` loosely; it returns { data: { token } }.
	const { data: token } = await (
		auth.token as () => Promise<{ data?: { token: string } }>
	)();
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/api/chats/${encodeURIComponent(id)}`,
		{
			headers: { authorization: `Bearer ${token?.token}` },
			cache: "no-store",
		},
	);
	// Missing, or another user's chat: back to a new chat, which shows a toast.
	if (res.status === 404) redirect("/dashboard/chat?notfound=1");
	if (!res.ok) throw new Error("Could not load the chat");
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
