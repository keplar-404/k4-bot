"use client";

import { BotIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { ChatHistory } from "@/components/chat-history";
import { NavGroups } from "@/components/nav-groups";
import { NavUser } from "@/components/nav-user";
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
} from "@/components/ui/sidebar";

export function AppSidebar({
	user,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: { name: string; email: string; image?: string | null };
}) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
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
							className="dark:bg-[#1B1C24]"
							tooltip="New chat"
							render={<Link href="/dashboard/chat" />}
						>
							<PlusIcon />
							<span className="font-medium">New chat</span>
							<Kbd className="ml-auto font-mono">Ctrl K</Kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{/* ponytail: static for now; filter the cached chat list when search ships. */}
				<div className="relative group-data-[collapsible=icon]:hidden">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
					<SidebarInput
						placeholder="Search"
						aria-label="Search chats"
						className="px-8 dark:bg-[#16171E]"
					/>
					<Kbd className="absolute top-1/2 right-1.5 -translate-y-1/2 font-mono">
						/
					</Kbd>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<NavGroups />
				<ChatHistory />
			</SidebarContent>
			<SidebarFooter className="border-t border-sidebar-border">
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
