"use client";

import { PlusIcon, ShieldIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { AvatarCreateDialog } from "@/features/bots/components/avatar-create-dialog";
import { BotList, BotListSkeleton } from "@/features/bots/components/bot-list";
import { BotSearchDialog } from "@/features/bots/components/bot-search-dialog";
import { DeleteBotDialog } from "@/features/bots/components/delete-bot-dialog";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useBotsUiStore } from "@/features/bots/ui-store";

export function NavProjects() {
  const router = useRouter();
  const pathname = usePathname();
  const { bots, isInitialLoading, createBot, updateBot, addAdminBot } =
    useBots();
  // The section's UI state lives in a shared store (the VM page asks to delete through it too).
  const dialogOpen = useBotsUiStore((s) => s.dialogOpen);
  const editingBot = useBotsUiStore((s) => s.editingBot);
  const confirming = useBotsUiStore((s) => s.confirming);
  const deleting = useBotsUiStore((s) => s.deleting);
  const openCreate = useBotsUiStore((s) => s.openCreate);
  const openEdit = useBotsUiStore((s) => s.openEdit);
  const setDialogOpen = useBotsUiStore((s) => s.setDialogOpen);
  const handleDelete = useBotsUiStore((s) => s.askDelete);
  const cancelDelete = useBotsUiStore((s) => s.cancelDelete);
  const confirmDelete = useBotsUiStore((s) => s.confirmDelete);

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
        onCancel={cancelDelete}
        onConfirm={() =>
          void confirmDelete((bot) => {
            // Leave the deleted bot's page if it was open.
            if (pathname === `/dashboard/bot/${bot.id}`)
              router.replace("/dashboard");
          })
        }
      />
      <AvatarCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
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
