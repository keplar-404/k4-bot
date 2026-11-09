"use client";

import {
  BrainIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ScrollTextIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import type { Bot } from "@/features/bots/api";
import { MemoryDialog } from "@/features/memory/memory-dialog";

/** One bot in the sidebar: a link to its chat, and a menu with Settings, Memory and Delete. */
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
  const [memoryOpen, setMemoryOpen] = useState(false);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-9 [&_svg]:size-7 group-data-[collapsible=icon]:p-0.5!"
        isActive={active}
        tooltip={bot.name}
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
          render={
            <SidebarMenuAction className="top-2! cursor-pointer group-data-[collapsible=icon]:hidden" />
          }
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
            <DropdownMenuItem onClick={() => setMemoryOpen(true)}>
              <BrainIcon />
              Memory
            </DropdownMenuItem>
            {bot.kind === "admin" && (
              <DropdownMenuItem render={<Link href="/dashboard/admin-log" />}>
                <ScrollTextIcon />
                Activity log
              </DropdownMenuItem>
            )}
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
      <MemoryDialog
        target={{ kind: "bot", botId: bot.id }}
        title={`${bot.name}'s memory`}
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
      />
    </SidebarMenuItem>
  );
}
