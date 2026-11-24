"use client";

import {
	BrainIcon,
	ChevronsUpDownIcon,
	LayoutGridIcon,
	LogOutIcon,
	SettingsIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type Section, SettingsDialog } from "@/components/settings-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Glide } from "@/components/ui/glide";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient, forgetToken } from "@/lib/auth-client";
import { clearChatCache } from "@/lib/chat-cache";

export function NavUser({
	user,
}: {
	user: { name: string; email: string; image?: string | null };
}) {
	const { isMobile } = useSidebar();
	const router = useRouter();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [start, setStart] = useState<Section>("account");
	const openSettings = (s: Section) => () => {
		setStart(s);
		setSettingsOpen(true);
	};
	const logOut = async () => {
		await clearChatCache(); // this browser's copy of their chats
		await authClient.signOut();
		forgetToken();
		router.push("/login");
		router.refresh();
	};
	const initials = user.name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	const avatar = (
		<Avatar>
			<AvatarImage
				src={user.image ?? undefined}
				alt={user.name}
				// Google profile photos refuse requests that send a referrer.
				referrerPolicy="no-referrer"
			/>
			<AvatarFallback>{initials}</AvatarFallback>
		</Avatar>
	);
	const who = (
		<div className="grid flex-1 text-left text-sm leading-tight">
			<span className="truncate font-medium">{user.name}</span>
			<span className="truncate text-xs">{user.email}</span>
		</div>
	);
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
						}
					>
						{avatar}
						{who}
						<ChevronsUpDownIcon className="ml-auto size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-fit"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<Glide items="[role^=menuitem]" />
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									{avatar}
									{who}
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem onClick={openSettings("apps")}>
								<LayoutGridIcon />
								Connected apps
							</DropdownMenuItem>
							<DropdownMenuItem onClick={openSettings("memory")}>
								<BrainIcon />
								Memory
							</DropdownMenuItem>
							<DropdownMenuItem onClick={openSettings("account")}>
								<SettingsIcon />
								Settings
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={logOut}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<SettingsDialog
					open={settingsOpen}
					onOpenChange={setSettingsOpen}
					user={user}
					onLogOut={logOut}
					start={start}
				/>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
