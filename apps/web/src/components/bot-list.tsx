"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { BloubAvatar } from "@/components/bloub-avatar";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { Bot } from "@/lib/bots";

function BotItem({
  bot,
  onEdit,
  onDelete,
}: {
  bot: Bot;
  onEdit: (bot: Bot) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={<a href={`/dashboard/bot/${bot.id}`} />}>
        <BloubAvatar
          size={28}
          shape={bot.shape}
          color={bot.color}
          expression={bot.expression}
        />
        <span>{bot.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuAction className="cursor-pointer" />}>
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

export function BotListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-6 w-2/3" />
    </div>
  );
}

export function BotList({
  bots,
  onEdit,
  onDelete,
}: {
  bots: Bot[];
  onEdit: (bot: Bot) => void;
  onDelete: (id: string) => void;
}) {
  if (!bots.length) {
    return <p className="px-2 text-xs text-muted-foreground">No bots yet.</p>;
  }
  return (
    <SidebarMenu>
      {bots.map((bot) => (
        <BotItem key={bot.id} bot={bot} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </SidebarMenu>
  );
}
