import { RoutinePage } from "@/features/routines/routine-page";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return <RoutinePage key={id} id={id} />;
}
