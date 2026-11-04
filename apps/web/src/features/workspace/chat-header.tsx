"use client";

import { PanelRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useOptionalWorkspace } from "./use-workspace";

/** The bot page's top bar: the app side bar button, the title, and (at the right) the button for the workspace side bar. */
export function ChatHeader() {
  const workspace = useOptionalWorkspace();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <span className="truncate text-sm font-medium">Chat</span>
      {workspace && (
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={
            workspace.sidebarOpen ? "Hide the workspace" : "Show the workspace"
          }
          aria-pressed={workspace.sidebarOpen}
          onClick={() => workspace.setSidebarOpen(!workspace.sidebarOpen)}
        >
          <PanelRightIcon />
        </Button>
      )}
    </header>
  );
}
