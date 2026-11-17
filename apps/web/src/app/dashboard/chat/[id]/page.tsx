import { SavedChat } from "@/components/chat/saved-chat";

// The chat loads in the browser behind ChatSkeleton, not in a streamed server
// <Suspense>: those can stay hidden and unhydrated (Next.js #94750).
export default async function ChatPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return <SavedChat key={id} id={id} />;
}
