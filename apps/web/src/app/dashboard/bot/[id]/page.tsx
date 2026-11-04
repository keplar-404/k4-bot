"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatView } from "@/features/chat/components/chat-view";
import { ComputerProvider } from "@/features/computer/components/computer-provider";

import { SessionWrapUp } from "@/features/computer/components/session-wrap-up";
import { CodeEditorMount } from "@/features/workspace/code/code-editor-mount";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";
import { WorkspaceSidebar } from "@/features/workspace/workspace-sidebar";

/**
 * `useParams()` is runtime-only data. With Cache Components enabled it must sit
 * inside a Suspense boundary, otherwise the prerender has no value for it and
 * the whole route fails to build.
 */
function BotChat() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const botId = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (!botId) {
      router.replace("/dashboard");
      return;
    }
  }, [botId, router]);

  if (!botId) {
    return null;
  }
  return (
    // The chat keeps its own column exactly as before; the workspace (computer, browser, files) is a side bar next to
    // it. One connection to the computer serves both (the chat shows its end-of-session prompt), and the workspace
    // context lets file cards in the chat open in the side bar.
    <ComputerProvider>
      <WorkspaceProvider botId={botId}>
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Keyed by bot: switching bots (client-side) starts a fresh chat instead of reusing the last one's state and socket. */}
            <ChatView
              key={botId}
              botId={botId}
              beforeComposer={<SessionWrapUp />}
            />
          </div>
          <WorkspaceSidebar botId={botId} />
          <CodeEditorMount botId={botId} />
        </div>
      </WorkspaceProvider>
    </ComputerProvider>
  );
}

export default function BotChatPage() {
  return (
    // Exactly one viewport tall: the document never scrolls, only the
    // conversation does (the scroller viewport inside ChatView).
    <div className="flex h-svh min-h-0 min-w-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="truncate text-sm font-medium">Chat</span>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        }
      >
        <BotChat />
      </Suspense>
    </div>
  );
}
