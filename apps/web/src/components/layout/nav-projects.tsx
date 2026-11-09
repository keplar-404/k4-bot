"use client";

import { PlusIcon, ShieldIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
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
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBot, setEditingBot] = React.useState<Bot | null>(null);
  const { bots, isInitialLoading, createBot, updateBot, deleteBot, addAdminBot } = useBots();

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
    <SidebarGroup>
      {/* Collapsed to icons, only the bots' avatars show: the label and the add/search buttons need the full width. */}
      <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
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
      {!isInitialLoading &&
        bots.length > 0 &&
        !bots.some((b) => b.kind === "admin") && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground group-data-[collapsible=icon]:hidden"
            onClick={() =>
              void addAdminBot().then(
                (b) => router.push(`/dashboard/bot/${b.id}`),
                (e: Error) => toast.error(e.message),
              )
            }
          >
            <ShieldIcon />
            Add an admin bot
          </Button>
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
        onSubmit={async (input) => {
          if (editingBot) return updateBot(editingBot.id, input);
          const created = await createBot(input);
          // A new bot opens straight away: that is what the user creates it for.
          if (created) router.push(`/dashboard/bot/${created.id}`);
          return created;
        }}
      />
    </SidebarGroup>
  );
}
