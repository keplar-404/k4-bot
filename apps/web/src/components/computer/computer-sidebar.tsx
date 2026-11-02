"use client";

import { MonitorIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ComputerPanel } from "@/components/computer/computer-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const WIDE = "(min-width: 1280px)";

function useWide() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

/**
 * The computer in the bot page's right side bar. On wide screens it sits beside the chat;
 * on narrower ones it opens from a button, so the chat keeps the full width. Only one of
 * the two is ever mounted (each opens its own connection to the computer).
 */
export function ComputerSidebar({ botId }: { botId: string }) {
  const wide = useWide();
  const [open, setOpen] = useState(false);

  if (wide) {
    return (
      <aside
        aria-label="Computer"
        className="flex w-80 shrink-0 flex-col overflow-y-auto border-l"
      >
        <ComputerPanel botId={botId} className="flex-1" />
      </aside>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Open the computer"
        className="fixed right-4 bottom-24 z-30 rounded-full shadow-md"
        onClick={() => setOpen(true)}
      >
        <MonitorIcon />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Computer</SheetTitle>
          <SheetDescription className="sr-only">
            Your computer: live preview, activity and usage.
          </SheetDescription>
          {open && <ComputerPanel botId={botId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
