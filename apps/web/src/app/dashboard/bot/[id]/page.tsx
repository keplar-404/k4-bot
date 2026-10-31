"use client";

import { useChat } from "@ai-sdk/react";
import { createChat } from "@shadcn/helpers/ai-sdk";
import { Suspense, use, useMemo } from "react";
import { BloubAvatar } from "@/components/bloub-avatar";
import PromptBar from "@/components/prompt-bar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { useBots } from "@/lib/use-bots";

// Scripted conversation through the real useChat lifecycle (AI SDK helper).
// Swapping to a real model backend later = replacing this transport.
const chat = createChat().assistant(
  "Hey! I'm your bot. Ask me anything to get started.",
);

const transport = chat.transport({
  fallback: ({ writer, messages }) => {
    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.parts.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ");
    writer.text(
      lastUser
        ? `Got it — "${lastUser}". I'm a demo reply for now; real model wiring comes next.`
        : "I'm a demo reply for now; real model wiring comes next.",
      { mode: "instant" },
    );
  },
});

function messageText(message: {
  role: string;
  parts: { type: string; text?: string }[];
}) {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

export default function BotChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // params is runtime data — unwrap inside Suspense so the shell can prerender
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <BotChatInner params={params} />
    </Suspense>
  );
}

function BotChatInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bots, isInitialLoading } = useBots();
  const bot = useMemo(() => bots.find((b) => b.id === id), [bots, id]);

  const { messages, sendMessage, status } = useChat({
    messages: chat.get(0),
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  if (isInitialLoading) {
    return (
      <div className="flex h-dvh flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end gap-3 px-4 pb-6">
          <Skeleton className="h-10 w-2/3 self-end rounded-2xl" />
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium">Bot not found</p>
        <p className="text-sm text-muted-foreground">
          This bot doesn&apos;t exist or was deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <BloubAvatar
          size={36}
          shape={bot.shape}
          color={bot.color}
          expression={bot.expression}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{bot.name}</p>
          {bot.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {bot.description}
            </p>
          ) : null}
        </div>
      </header>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  {message.role === "user" ? (
                    <Message align="end">
                      <MessageContent>
                        <Bubble align="end" variant="muted">
                          <BubbleContent>{messageText(message)}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message>
                      <MessageContent>{messageText(message)}</MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptBar
          demo={false}
          tall
          placeholder={`Message ${bot.name}…`}
          onSend={(text) => {
            if (isBusy) return;
            void sendMessage({ text });
          }}
        />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Demo mode — scripted replies until the model backend is wired.
        </p>
      </div>
    </div>
  );
}
