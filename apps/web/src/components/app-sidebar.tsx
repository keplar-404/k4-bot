"use client";

import { BotIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { ChatHistory } from "@/components/chat-history";
import { NavGroups } from "@/components/nav-groups";
import { NavUser } from "@/components/nav-user";
import { Glide } from "@/components/ui/glide";
import { Kbd } from "@/components/ui/kbd";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
	useSidebar,
} from "@/components/ui/sidebar";

// One highlight glides between the sidebar's items on hover.
const MENU_ITEMS =
	"[data-sidebar=menu-button],[data-slot=sidebar-menu-sub-button]";

export function AppSidebar({
	user,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: { name: string; email: string; image?: string | null };
}) {
	const { setOpen } = useSidebar();
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<Glide items={MENU_ITEMS} className="bg-sidebar-accent" />
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip="K4"
							render={<Link href="/dashboard/chat" />}
						>
							<div className="flex aspect-square size-6 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
								<BotIcon className="size-3.5" />
							</div>
							<span className="truncate font-mono font-semibold">K4</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							variant="outline"
							tooltip="New chat"
							render={<Link href="/dashboard/chat" />}
						>
							<PlusIcon />
							<span className="font-medium">New chat</span>
							<Kbd className="ml-auto font-mono">Ctrl K</Kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
					{/* Collapsed: the search box becomes an icon that opens the sidebar on it. */}
					<SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
						<SidebarMenuButton
							tooltip="Search"
							onClick={() => {
								setOpen(true);
								setTimeout(
									() => document.getElementById("chat-search")?.focus(),
									250,
								);
							}}
						>
							<SearchIcon />
							<span>Search</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{/* ponytail: static for now; filter the cached chat list when search ships. */}
				<div className="relative group-data-[collapsible=icon]:hidden">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
					<SidebarInput
						id="chat-search"
						placeholder="Search"
						aria-label="Search chats"
						className="px-8"
					/>
					<Kbd className="absolute top-1/2 right-1.5 -translate-y-1/2 font-mono">
						/
					</Kbd>
				</div>
			</SidebarHeader>
			<SidebarSeparator className="hidden group-data-[collapsible=icon]:block" />
			<SidebarContent>
				<Glide items={MENU_ITEMS} className="bg-sidebar-accent" />
				<NavGroups />
				<SidebarSeparator className="hidden group-data-[collapsible=icon]:block" />
				<ChatHistory />
			</SidebarContent>
			<SidebarFooter className="border-t border-sidebar-border">
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
