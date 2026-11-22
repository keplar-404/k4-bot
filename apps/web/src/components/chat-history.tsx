"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
	dropCachedChat,
	forgetChatCheck,
	getCachedList,
	putCachedList,
} from "@/lib/chat-cache";

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
		// This browser's saved list shows at once; the API's answer replaces it.
		let fresh = false;
		void getCachedList().then((list) => {
			if (list && !fresh) {
				setChats(list);
				setLoading(false);
			}
		});
		const load = async () => {
			const res = await api.api.chats.$get().catch(() => undefined);
			if (res?.ok) {
				fresh = true;
				setChats((await res.json()).chats);
			}
			setLoading(false);
		};
		void load();
		window.addEventListener(CHATS_CHANGED, load);
		return () => window.removeEventListener(CHATS_CHANGED, load);
	}, []);

	// Save every change (load, create, delete) for the next page load.
	useEffect(() => {
		if (!loading)
			void putCachedList(chats.map(({ id, title }) => ({ id, title })));
	}, [chats, loading]);

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
		void dropCachedChat(chat.id);
		forgetChatCheck(chat.id);
		setChats((c) => c.filter((x) => x.id !== chat.id));
		if (pathname === `/dashboard/chat/${chat.id}`)
			router.push("/dashboard/chat");
	}

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
				Recent
			</SidebarGroupLabel>
			<SidebarMenu>
				{loading &&
					[0, 1, 2, 3, 4].map((i) => (
						<SidebarMenuItem key={i}>
							<SidebarMenuSkeleton />
						</SidebarMenuItem>
					))}
				{chats.map((chat) => (
					<SidebarMenuItem key={chat.id}>
						<SidebarMenuButton
							isActive={pathname === `/dashboard/chat/${chat.id}`}
							render={<Link href={`/dashboard/chat/${chat.id}`} />}
						>
							<span className={deleting.has(chat.id) ? "shimmer" : undefined}>
								{chat.title}
							</span>
						</SidebarMenuButton>
						{deleting.has(chat.id) ? (
							<SidebarMenuAction aria-label="Deleting">
								<LoaderCircleIcon className="animate-spin" />
							</SidebarMenuAction>
						) : (
							<SidebarMenuAction
								showOnHover
								aria-label={`Delete ${chat.title}`}
								className="hover:text-destructive"
								onClick={() => void remove(chat)}
							>
								<Trash2Icon />
							</SidebarMenuAction>
						)}
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
