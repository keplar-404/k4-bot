"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ChatView } from "@/components/chat-view";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `useParams()` is runtime-only data. With Cache Components enabled it must sit
 * inside a Suspense boundary, otherwise the prerender has no value for it and
 * the whole route fails to build.
 */
function BotChat() {
  const params = useParams<{ id: string }>();
  const botId = typeof params.id === "string" ? params.id : "";

  if (!botId) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No bot selected.</p>
    );
  }
  return <ChatView botId={botId} />;
}

export default function BotChatPage() {
  return (
    // Exactly one viewport tall: the document never scrolls, only the
    // conversation does (the scroller viewport inside ChatView).
    <div className="flex h-svh min-h-0 flex-col">
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
