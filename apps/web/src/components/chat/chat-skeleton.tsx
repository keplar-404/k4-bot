import { Skeleton } from "@/components/ui/skeleton";

// Shown while a saved chat loads: user bubbles on the right, replies on the left.
export function MessagesSkeleton() {
	return (
		<div
			role="status"
			aria-label="Loading chat"
			className="mx-auto flex max-w-4xl flex-col gap-6 py-2"
		>
			{[0, 1].map((i) => (
				<div key={i} className="flex flex-col gap-6">
					<Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-4 w-11/12" />
						<Skeleton className="h-4 w-4/5" />
						<Skeleton className="h-4 w-3/5" />
					</div>
				</div>
			))}
		</div>
	);
}

// The whole chat page, for the server's <Suspense> while it looks up the chat.
// Same outer layout as <Chat>, so nothing jumps when it swaps in.
export function ChatSkeleton() {
	return (
		<div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col gap-2 px-3 pb-3 *:mx-auto *:w-full *:max-w-4xl sm:px-6 sm:pb-4">
			<div className="flex items-center justify-between gap-2">
				<div className="flex flex-col gap-1.5">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-56" />
				</div>
				<Skeleton className="size-9" />
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				<MessagesSkeleton />
			</div>
			<Skeleton className="h-28 rounded-xl" />
		</div>
	);
}
