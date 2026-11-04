"use client";

import { PanelRightIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./use-workspace";
import { WorkspacePanels } from "./workspace-panels";

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
 * The bot page's right side bar: Computer, Browser, Files and open files as tabs. Beside the chat on wide screens
 * (wider while a page or file is shown); on narrow ones it opens from a button, with the same tabs.
 */
export function WorkspaceSidebar({ botId }: { botId: string }) {
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const { tabs, activeId } = useWorkspace();
  const roomy = tabs.find((t) => t.id === activeId)?.kind !== "computer";

  if (wide) {
    return (
      <aside
        aria-label="Workspace"
        className={cn(
          "flex shrink-0 flex-col border-l transition-[width] duration-200",
          roomy ? "w-[34rem]" : "w-80",
        )}
      >
        <WorkspacePanels botId={botId} />
      </aside>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Open the workspace"
        className="fixed right-4 bottom-24 z-30 rounded-full shadow-md"
        onClick={() => setOpen(true)}
      >
        <PanelRightIcon />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-lg"
        >
          <SheetTitle className="sr-only">Workspace</SheetTitle>
          <SheetDescription className="sr-only">
            Your computer, a browser and this bot&apos;s files.
          </SheetDescription>
          {open && <WorkspacePanels botId={botId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
