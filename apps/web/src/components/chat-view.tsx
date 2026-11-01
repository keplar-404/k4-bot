"use client";

import { Loader2Icon, RotateCcwIcon, ShieldQuestionIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import PromptBar from "@/components/prompt-bar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/lib/chat/use-chat";

/**
 * Renders every state the transport can produce. If a failure has no branch
 * here, the user sees a frozen screen, which is the bug this file exists to
 * prevent.
 *
 * Layout: this fills its parent (`flex-1 min-h-0`) and the scroller viewport is
 * the only scrolling element, so the mouse wheel scrolls the conversation.
 */
export function ChatView({ botId }: { botId: string }) {
  const {
    messages,
    run,
    approval,
    connection,
    error,
    isLoading,
    models,
    chooseModel,
    chooseReasoningEffort,
    send,
    retry,
    dismissError,
    approve,
    reject,
  } = useChat(botId);

  // PromptBar expects { key, name, ... }; the API speaks full OpenRouter ids.
  const catalog = models.map((m) => ({
    key: m.id,
    name: (m.id.split("/").pop() ?? m.id).replace(/:free$/, ""),
    tag: m.tag,
    vision: m.vision,
    reasoning: m.reasoning,
    reasoningEfforts: m.reasoningEfforts,
  }));

  // ONE toast, keyed by a single id, so losing the socket never shows two.
  useEffect(() => {
    if (connection === "offline") {
      toast.warning("You're offline", {
        id: "connection",
        description: "Messages will send when you're back.",
        duration: Number.POSITIVE_INFINITY,
      });
      return;
    }
    if (connection === "open" || connection === "idle") {
      toast.dismiss("connection");
    }
  }, [connection]);

  useEffect(() => {
    if (!error) return;
    // A network error is the same event as "offline": the connection toast
    // says it once. Only real server/model errors get their own toast.
    if (error.kind !== "network") {
      toast.error(error.message, {
        id: "chat-error",
        description: error.retryable
          ? "Retry from the message above."
          : undefined,
      });
    }
    dismissError();
  }, [error, dismissError]);

  const last = messages.at(-1);
  // Sent, accepted, but no token yet: the agent is working.
  const thinking = run === "running" && last?.role === "user";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            {/* justify-end keeps a short thread anchored above the composer
                instead of floating at the very top of a tall viewport. */}
            <MessageScrollerContent className="justify-end px-4">
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
              {messages.map((m) => {
                const isUser = m.role === "user";
                // A failed answer with no text is just the error line, not an empty bubble.
                const hideBubble = m.state === "failed" && !isUser && !m.text;
                return (
                  <MessageScrollerItem key={m.id} messageId={m.id}>
                    <Message align={isUser ? "end" : "start"}>
                      <MessageContent>
                        {!hideBubble && (
                          <Bubble
                            align={isUser ? "end" : "start"}
                            variant={isUser ? "default" : "muted"}
                          >
                            <BubbleContent>
                              <span
                                className={
                                  m.state === "sending"
                                    ? "opacity-60"
                                    : undefined
                                }
                              >
                                {m.text || (m.state === "sending" ? "…" : "")}
                              </span>
                            </BubbleContent>
                          </Bubble>
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
                            // Provider text stays available to whoever debugs,
                            // never in the reading path.
                            title={m.error?.detail}
                          >
                            {m.error?.message ?? "Failed to send"}
                            {m.error?.retryable && (
                              <button
                                type="button"
                                onClick={() => void retry(m.id)}
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
              })}
              {thinking && (
                <span className="flex items-center gap-1 px-1 pb-2 text-xs text-muted-foreground">
                  <Loader2Icon className="size-3 animate-spin" />
                  Thinking…
                </span>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>

      {run === "waiting_approval" && approval && (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <ShieldQuestionIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Approve{" "}
            {approval.actions
              .map(
                (a) =>
                  `${a.name}${a.args.file_path ? ` ${String(a.args.file_path)}` : ""}`,
              )
              .join(", ")}
            ?
          </span>
          <Button size="sm" variant="outline" onClick={() => void reject()}>
            Reject
          </Button>
          <Button size="sm" onClick={() => void approve()}>
            Approve
          </Button>
        </div>
      )}

      <div className="p-4">
        <PromptBar
          demo={false}
          onSend={(text) => void send(text)}
          models={catalog.length > 0 ? catalog : undefined}
          onModelChange={(m) => chooseModel(m.key)}
          onReasoningChange={(effort) => chooseReasoningEffort(effort)}
        />
      </div>
    </div>
  );
}
