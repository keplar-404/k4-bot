"use client";

import { Loader2Icon } from "lucide-react";
import { MessageScrollerContent } from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessageView } from "@/features/chat/lib/protocol";
import { MessageItem } from "./message-item";

export function MessageList({
  messages,
  isLoading,
  thinking,
  onRetry,
}: {
  messages: ChatMessageView[];
  isLoading: boolean;
  thinking: boolean;
  onRetry: (id: string) => void;
}) {
  return (
    <MessageScrollerContent className="justify-end px-4 py-6">
      {isLoading && (
        <output
          className="flex flex-col gap-4 py-6"
          aria-busy="true"
          aria-label="Loading conversation"
        >
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-20 w-3/5 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-44 rounded-2xl" />
          </div>
        </output>
      )}
      {messages.map((m) => (
        <MessageItem key={m.id} m={m} onRetry={onRetry} />
      ))}
      {thinking && (
        <span className="flex items-center gap-1 px-1 pb-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          Thinking…
        </span>
      )}
    </MessageScrollerContent>
  );
}
