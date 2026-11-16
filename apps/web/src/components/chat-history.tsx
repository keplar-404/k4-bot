"use client";

import {
	LoaderCircleIcon,
	MessageSquareIcon,
	MoreHorizontalIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { api, CHATS_CHANGED } from "@/lib/api";

type Chat = { id: string; title: string };

// The signed-in user's chats (the backend filters by user), newest first.
export function ChatHistory() {
	const [chats, setChats] = useState<Chat[]>([]);
	const [loading, setLoading] = useState(true);
	// A set, so starting a second delete keeps the first one's spinner.
	const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set());
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		const load = async () => {
			const res = await api.api.chats.$get();
			if (res.ok) setChats((await res.json()).chats);
			setLoading(false);
		};
		void load();
		window.addEventListener(CHATS_CHANGED, load);
		return () => window.removeEventListener(CHATS_CHANGED, load);
	}, []);

	async function remove(chat: Chat) {
		setDeleting((s) => new Set(s).add(chat.id));
		const res = await api.api.chats[":id"]
			.$delete({ param: { id: chat.id } })
			.catch(() => undefined);
		setDeleting((s) => {
			const next = new Set(s);
			next.delete(chat.id);
			return next;
		});
		if (!res?.ok) return;
		setChats((c) => c.filter((x) => x.id !== chat.id));
		if (pathname === `/dashboard/chat/${chat.id}`)
			router.push("/dashboard/chat");
	}

	return (
		<SidebarGroup>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						tooltip="New chat"
						render={<Link href="/dashboard/chat" />}
					>
						<PlusIcon />
						<span>New chat</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
			<SidebarGroupLabel>History</SidebarGroupLabel>
			<SidebarMenu>
				{loading &&
					[0, 1, 2, 3, 4].map((i) => (
						<SidebarMenuItem key={i}>
							<SidebarMenuSkeleton showIcon />
						</SidebarMenuItem>
					))}
				{chats.map((chat) => (
					<SidebarMenuItem key={chat.id}>
						<SidebarMenuButton
							isActive={pathname === `/dashboard/chat/${chat.id}`}
							render={<Link href={`/dashboard/chat/${chat.id}`} />}
						>
							<MessageSquareIcon />
							<span className={deleting.has(chat.id) ? "shimmer" : undefined}>
								{chat.title}
							</span>
						</SidebarMenuButton>
						{deleting.has(chat.id) ? (
							<SidebarMenuAction aria-label="Deleting">
								<LoaderCircleIcon className="animate-spin" />
							</SidebarMenuAction>
						) : (
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<SidebarMenuAction
											showOnHover
											aria-label={`More for ${chat.title}`}
										/>
									}
								>
									<MoreHorizontalIcon />
								</DropdownMenuTrigger>
								<DropdownMenuContent side="right" align="start">
									<DropdownMenuItem
										variant="destructive"
										onClick={() => void remove(chat)}
									>
										<Trash2Icon />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
