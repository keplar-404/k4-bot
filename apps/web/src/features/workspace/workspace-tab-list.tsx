"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabIcon } from "./tab-icons";
import { useWorkspace } from "./use-workspace";

/** The tab strip: icon + title, a close button on every tab, "+" for a new Start tab. */
export function WorkspaceTabList() {
  const { tabs, close, newTab } = useWorkspace();
  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <TabsList variant="line" className="h-auto w-auto gap-1 p-0">
          {tabs.map((t) => (
            <span
              key={t.id}
              className="flex shrink-0 items-center rounded-lg pr-1 has-data-active:bg-muted"
            >
              <TabsTrigger
                value={t.id}
                className="h-8 max-w-40 flex-none gap-2 px-2.5 after:hidden"
              >
                <TabIcon kind={t.kind} className="size-4" />
                <span className="truncate">{t.title}</span>
              </TabsTrigger>
              <button
                type="button"
                aria-label={`Close ${t.title}`}
                onClick={() => close(t.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </TabsList>
        <Button
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          aria-label="New tab"
          title="New tab"
          onClick={newTab}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
