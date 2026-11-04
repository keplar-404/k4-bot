"use client";

import { CodeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "./use-workspace";

/** The tab strip. A file or extra browser tab has its close button beside it (a button may not sit inside another). */
export function WorkspaceTabList() {
  const { tabs, close, setEditorOpen } = useWorkspace();
  return (
    <div className="flex items-center overflow-x-auto border-b px-2 py-1">
      <TabsList className="h-8">
        {tabs.map((t) => (
          <span key={t.id} className="flex items-center">
            <TabsTrigger value={t.id} className="max-w-36 truncate">
              {t.title}
            </TabsTrigger>
            {(t.kind === "file" ||
              (t.kind === "browser" && t.id !== "browser")) && (
              <button
                type="button"
                aria-label={`Close ${t.title}`}
                onClick={() => close(t.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </span>
        ))}
      </TabsList>
      <Button
        size="icon-sm"
        variant="ghost"
        className="ml-auto shrink-0"
        aria-label="Open the code editor"
        title="Open the code editor"
        onClick={() => setEditorOpen(true)}
      >
        <CodeIcon />
      </Button>
    </div>
  );
}
