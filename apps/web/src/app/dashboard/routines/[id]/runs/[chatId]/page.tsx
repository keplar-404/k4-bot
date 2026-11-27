import { RunChat } from "@/features/routines/run-chat";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string; chatId: string }>;
}) {
	const { id, chatId } = await params;
	return <RunChat key={chatId} routineId={id} chatId={chatId} />;
}
