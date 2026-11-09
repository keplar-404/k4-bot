"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Group } from "./api";
import { AvatarStack } from "./avatar-stack";

/** One group in the sidebar: its bots' avatars and name, a link to its chat, and Settings / Delete. */
export function GroupItem({
  group,
  active,
  onEdit,
  onDelete,
}: {
  group: Group;
  active: boolean;
  onEdit: (g: Group) => void;
  onDelete: (g: Group) => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-9 group-data-[collapsible=icon]:p-0.5!"
        isActive={active}
        tooltip={group.name}
        render={<Link href={`/dashboard/group/${group.id}`} />}
      >
        <AvatarStack members={group.members} size={20} max={2} />
        <span className="truncate">{group.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction className="top-2! cursor-pointer group-data-[collapsible=icon]:hidden" />
          }
        >
          <MoreHorizontalIcon />
          <span className="sr-only">More options for {group.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(group)}>
              <PencilIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(group)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
