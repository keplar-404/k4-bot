"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import type { Bot } from "@/features/bots/api";
import { AvatarCreateDialog } from "@/features/bots/components/avatar-create-dialog";
import { BotList, BotListSkeleton } from "@/features/bots/components/bot-list";
import { BotSearchDialog } from "@/features/bots/components/bot-search-dialog";
import { DeleteBotDialog } from "@/features/bots/components/delete-bot-dialog";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useDeleteBot } from "@/features/bots/hooks/use-delete-bot";

export function NavProjects() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBot, setEditingBot] = React.useState<Bot | null>(null);
  const { bots, isInitialLoading, createBot, updateBot, deleteBot } = useBots();

  const openEdit = React.useCallback((bot: Bot) => {
    setEditingBot(bot);
    setDialogOpen(true);
  }, []);

  const openCreate = React.useCallback(() => {
    setEditingBot(null);
    setDialogOpen(true);
  }, []);

  const handleDialogOpenChange = React.useCallback((next: boolean) => {
    setDialogOpen(next);
    if (!next) setEditingBot(null);
  }, []);

  const { confirming, setConfirming, deleting, handleDelete, confirmDelete } =
    useDeleteBot(bots, deleteBot);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>Bots</SidebarGroupLabel>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openCreate}
            aria-label="Create avatar"
          >
            <PlusIcon />
          </Button>
          <BotSearchDialog bots={bots} />
        </div>
      </div>
      {isInitialLoading ? (
        <BotListSkeleton />
      ) : (
        <BotList bots={bots} onEdit={openEdit} onDelete={handleDelete} />
      )}
      <DeleteBotDialog
        bot={confirming}
        deleting={deleting}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirmDelete()}
      />
      <AvatarCreateDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        bot={editingBot ?? undefined}
        onSubmit={(input) =>
          editingBot ? updateBot(editingBot.id, input) : createBot(input)
        }
      />
    </SidebarGroup>
  );
}
