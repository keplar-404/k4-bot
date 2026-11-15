"use client";

import {
	ChevronsUpDownIcon,
	LogOutIcon,
	MonitorIcon,
	MoonIcon,
	SunIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export function NavUser({
	user,
}: {
	user: { name: string; email: string; image?: string | null };
}) {
	const { isMobile } = useSidebar();
	const { setTheme } = useTheme();
	const router = useRouter();
	const initials = user.name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	const avatar = (
		<Avatar>
			<AvatarImage src={user.image ?? undefined} alt={user.name} />
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
							<DropdownMenuItem onClick={() => setTheme("light")}>
								<SunIcon />
								Light
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setTheme("dark")}>
								<MoonIcon />
								Dark
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setTheme("system")}>
								<MonitorIcon />
								System
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={async () => {
								await authClient.signOut();
								router.push("/login");
								router.refresh();
							}}
						>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
