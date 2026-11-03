"use client";

import { usePathname } from "next/navigation";
import { SidebarMenu } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bot } from "@/features/bots/api";
import { BotItem } from "./bot-item";

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
  const pathname = usePathname();
  if (!bots.length) {
    return <p className="px-2 text-xs text-muted-foreground">No bots yet.</p>;
  }
  return (
    <SidebarMenu>
      {bots.map((bot) => (
        <BotItem
          key={bot.id}
          bot={bot}
          active={pathname === `/dashboard/bot/${bot.id}`}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </SidebarMenu>
  );
}
