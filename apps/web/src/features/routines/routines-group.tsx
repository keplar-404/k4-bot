"use client";

// Routines plug-in: the sidebar's Routines group, with + to create one.
import { ClockIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { CreateRoutineDialog } from "./create-dialog";
import { useRoutines } from "./data";

export function RoutinesGroup() {
	const { data } = useRoutines();
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
				Routines
			</SidebarGroupLabel>
			<SidebarGroupAction title="New routine" onClick={() => setOpen(true)}>
				<PlusIcon />
				<span className="sr-only">New routine</span>
			</SidebarGroupAction>
			<SidebarMenu>
				{!data &&
					[0, 1].map((i) => (
						<SidebarMenuItem key={i}>
							<SidebarMenuSkeleton />
						</SidebarMenuItem>
					))}
				{data?.routines.map((r) => {
					const href = `/dashboard/routines/${r.id}`;
					return (
						<SidebarMenuItem key={r.id}>
							<SidebarMenuButton
								isActive={pathname.startsWith(href)}
								tooltip={r.name}
								render={<Link href={href} />}
							>
								<ClockIcon className={r.enabled ? undefined : "opacity-40"} />
								<span>{r.name}</span>
							</SidebarMenuButton>
							{r.needs > 0 && (
								<SidebarMenuBadge
									className="bg-primary text-primary-foreground"
									title={`${r.needs} need you`}
								>
									{r.needs}
								</SidebarMenuBadge>
							)}
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
			<CreateRoutineDialog open={open} onOpenChange={setOpen} />
		</SidebarGroup>
	);
}
