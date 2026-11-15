"use client";

import { BotIcon } from "lucide-react";
import type * as React from "react";
import { ChatHistory } from "@/components/chat-history";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
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
						<SidebarMenuButton size="lg">
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<BotIcon className="size-4" />
							</div>
							<span className="truncate font-medium">K4</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<ChatHistory />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
