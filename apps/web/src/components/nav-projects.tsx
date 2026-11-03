"use client";

import { Loader2Icon, PlusIcon, SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { AvatarCreateDialog } from "@/components/avatar-create-dialog";
import { BloubAvatar } from "@/components/bloub-avatar";
import { BotList, BotListSkeleton } from "@/components/bot-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import type { Bot } from "@/lib/bots";
import { useBots } from "@/lib/use-bots";

export function NavProjects() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);
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

  // Deleting is irreversible (chats and the bot's files on the computer go too), so it is confirmed first.
  const [confirming, setConfirming] = React.useState<Bot | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = React.useCallback(
    (id: string) => setConfirming(bots.find((b) => b.id === id) ?? null),
    [bots],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!confirming) return;
    setDeleting(true);
    try {
      await deleteBot(confirming.id);
      toast.success(`${confirming.name} was deleted.`);
      if (pathname === `/dashboard/bot/${confirming.id}`) {
        router.replace("/dashboard");
      }
      setConfirming(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete bot.");
    } finally {
      setDeleting(false);
    }
  }, [confirming, deleteBot, pathname, router]);

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
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="mr-1" />
              }
            >
              <SearchIcon />
              <span className="sr-only">Search bots</span>
            </DialogTrigger>
            <DialogContent className="p-0">
              <DialogHeader className="px-4 pt-4">
                <DialogTitle>Search bots</DialogTitle>
              </DialogHeader>
              <Command>
                <CommandInput placeholder="Search bots..." />
                <CommandList>
                  <CommandEmpty>No bots found.</CommandEmpty>
                  <CommandGroup heading="Bots">
                    {bots.map((bot) => (
                      <CommandItem
                        key={bot.id}
                        value={bot.name}
                        onSelect={() => {
                          router.push(`/dashboard/bot/${bot.id}`);
                          setSearchOpen(false);
                        }}
                      >
                        <BloubAvatar
                          size={18}
                          shape={bot.shape}
                          color={bot.color}
                          expression={bot.expression}
                        />
                        <span>{bot.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {isInitialLoading ? (
        <BotListSkeleton />
      ) : (
        <BotList bots={bots} onEdit={openEdit} onDelete={handleDelete} />
      )}
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && !deleting && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the bot, all of its chats, and its folder
              and files on your computer. Anything it is doing now stops. Your
              other bots and their files are not affected. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting && <Loader2Icon className="animate-spin" />}
              Delete bot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
