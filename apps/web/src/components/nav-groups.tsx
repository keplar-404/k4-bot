"use client";

import {
	ChevronRightIcon,
	CrownIcon,
	FileTextIcon,
	GlobeIcon,
	MegaphoneIcon,
	PlusIcon,
	SearchIcon,
	ShoppingBagIcon,
	SparklesIcon,
	VideoIcon,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

// ponytail: static placeholder (and static highlight/shortcut hints), replace with a
// groups table + chat.groupId when groups ship.
const GROUPS = [
	{
		name: "Launch day",
		icon: CrownIcon,
		tile: "bg-amber-950 text-amber-400",
		open: true,
		items: [
			{ name: "Landing page", icon: GlobeIcon, tile: "bg-red-500 text-white" },
			{
				name: "Store listing",
				icon: ShoppingBagIcon,
				tile: "bg-blue-600 text-white",
			},
			{
				name: "Launch posts",
				icon: SparklesIcon,
				tile: "bg-green-700 text-white",
			},
		],
	},
	{
		name: "Video making",
		icon: VideoIcon,
		tile: "bg-sky-950 text-sky-400",
		items: [
			{ name: "Reel edit", icon: VideoIcon, tile: "bg-orange-500 text-white" },
			{ name: "Shorts", icon: VideoIcon, tile: "bg-blue-600 text-white" },
		],
	},
	{
		name: "Marketing",
		icon: MegaphoneIcon,
		tile: "bg-violet-950 text-violet-400",
		items: [
			{ name: "SEO audit", icon: SearchIcon, tile: "bg-violet-600 text-white" },
		],
	},
	{
		name: "Docs",
		icon: FileTextIcon,
		tile: "bg-zinc-800 text-zinc-300",
		items: [
			{ name: "Q3 report", icon: FileTextIcon, tile: "bg-zinc-600 text-white" },
		],
	},
];

// The small square icon tile from the design.
function Tile({ icon: Icon, tile }: { icon: typeof CrownIcon; tile: string }) {
	return (
		<span
			className={`flex size-4 shrink-0 items-center justify-center rounded-sm ${tile}`}
		>
			<Icon className="size-2.5" />
		</span>
	);
}

export function NavGroups() {
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
				Groups
			</SidebarGroupLabel>
			<SidebarGroupAction title="New group">
				<PlusIcon />
				<span className="sr-only">New group</span>
			</SidebarGroupAction>
			<SidebarMenu>
				{GROUPS.map((group, i) => (
					<Collapsible
						key={group.name}
						defaultOpen={group.open}
						render={<SidebarMenuItem />}
					>
						<CollapsibleTrigger
							render={
								<SidebarMenuButton tooltip={group.name} isActive={i === 0} />
							}
						>
							<ChevronRightIcon className="text-muted-foreground transition-transform group-data-[collapsible=icon]:hidden in-data-panel-open:rotate-90" />
							<Tile icon={group.icon} tile={group.tile} />
							<span className="font-medium">{group.name}</span>
							<Kbd className="ml-auto font-mono">Ctrl {i + 1}</Kbd>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<SidebarMenuSub>
								{group.items.map((item, j) => (
									<SidebarMenuSubItem key={item.name}>
										<SidebarMenuSubButton
											isActive={i === 0 && j === 0}
											render={<button type="button" />}
										>
											<Tile icon={item.icon} tile={item.tile} />
											<span>{item.name}</span>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
								))}
							</SidebarMenuSub>
						</CollapsibleContent>
					</Collapsible>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
