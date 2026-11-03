"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import type { Bot } from "@/features/bots/api";

/** The sidebar's search button: find a bot by name and open its chat. */
export function BotSearchDialog({ bots }: { bots: Bot[] }) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="mr-1" />}
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
  );
}
