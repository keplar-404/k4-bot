"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { AgentParts } from "@/features/chat/components/agent-parts";
import type { ChatMessageView } from "@/features/chat/lib/protocol";
import { FileList } from "@/features/files/components/file-list";

export function MessageItem({
  m,
  onRetry,
}: {
  m: ChatMessageView;
  onRetry: (id: string) => void;
}) {
  const isUser = m.role === "user";
  return (
    <MessageScrollerItem key={m.id} messageId={m.id}>
      <Message align={isUser ? "end" : "start"}>
        <MessageContent
          className={
            isUser ? "max-w-[85%] md:max-w-[50%]" : "max-w-full md:max-w-[70%]"
          }
        >
          {isUser ? (
            <>
              {m.files && m.files.length > 0 && (
                <FileList files={m.files} compact />
              )}
              {m.text && (
                <Bubble align="end" variant="default">
                  <BubbleContent>
                    <span
                      className={
                        m.state === "sending" ? "opacity-60" : undefined
                      }
                    >
                      {m.text}
                    </span>
                  </BubbleContent>
                </Bubble>
              )}
            </>
          ) : m.parts ? (
            <AgentParts parts={m.parts} streaming={m.state === "sending"} />
          ) : (
            m.text && (
              <Markdown isStreaming={m.state === "sending"}>{m.text}</Markdown>
            )
          )}
          {m.state === "sending" && isUser && (
            <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" />
              Sending
            </span>
          )}
          {m.state === "failed" && (
            <span
              className="flex items-center gap-2 px-1 text-[11px] text-destructive"
              title={m.error?.detail}
            >
              {m.error?.message ?? "Failed to send"}
              {m.error?.retryable && (
                <button
                  type="button"
                  onClick={() => void onRetry(m.id)}
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <RotateCcwIcon className="size-3" />
                  Retry
                </button>
              )}
            </span>
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
