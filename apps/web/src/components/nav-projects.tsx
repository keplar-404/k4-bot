"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { AvatarCreateDialog } from "@/components/avatar-create-dialog";
import { BloubAvatar } from "@/components/bloub-avatar";
import { BotList, BotListSkeleton } from "@/components/bot-list";
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

  const handleDelete = React.useCallback(
    (id: string) => {
      deleteBot(id)
        .then(() => {
          if (pathname === `/dashboard/bot/${id}`) {
            router.replace("/dashboard");
          }
        })
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : "Failed to delete bot.");
        });
    },
    [deleteBot, pathname, router],
  );

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
                          window.location.href = `/dashboard/bot/${bot.id}`;
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
