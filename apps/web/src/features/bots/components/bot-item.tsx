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
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import type { Bot } from "@/features/bots/api";

/** One bot in the sidebar: a link to its chat, and a menu with Settings and Delete. */
export function BotItem({
  bot,
  active,
  onEdit,
  onDelete,
}: {
  bot: Bot;
  active: boolean;
  onEdit: (bot: Bot) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-9 [&_svg]:size-7"
        isActive={active}
        render={<Link href={`/dashboard/bot/${bot.id}`} />}
      >
        <BloubAvatar
          size={28}
          shape={bot.shape}
          color={bot.color}
          expression={bot.expression}
        />
        <span>{bot.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<SidebarMenuAction className="top-2! cursor-pointer" />}
        >
          <MoreHorizontalIcon />
          <span className="sr-only">More options for {bot.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(bot)}>
              <PencilIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(bot.id)}
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
