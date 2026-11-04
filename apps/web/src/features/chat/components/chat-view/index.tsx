"use client";
import type { ReactNode } from "react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { useAttachments } from "@/features/chat/hooks/use-attachments";
import { useChat } from "@/features/chat/hooks/use-chat";
import { toCatalog } from "./catalog";
import { MessageList } from "./message-list";
import { Prompts } from "./prompts";
import { ScrollToEndOnSend } from "./scroll-to-end";
import { useChatEffects } from "./use-effects";
/**
 * Renders every state the transport can produce. If a failure has no branch
 * here, the user sees a frozen screen, which is the bug this file exists to
 * prevent.
 *
 * Layout: this fills its parent (`flex-1 min-h-0`) and the scroller viewport is
 * the only scrolling element, so the mouse wheel scrolls the conversation.
 */
export function ChatView({
  botId,
  beforeComposer,
}: {
  botId: string;
  /** Shown above the composer with the other prompts (e.g. the computer's end-of-session prompt). */
  beforeComposer?: ReactNode;
}) {
  const {
    messages,
    run,
    approval,
    prompt,
    sleeping,
    usage,
    answer,
    stop,
    connection,
    error,
    isLoading,
    models,
    modelId,
    reasoningEffort,
    chooseModel,
    send,
    retry,
    dismissError,
    approve,
    reject,
  } = useChat(botId);
  const attachments = useAttachments(botId);
  useChatEffects(botId, connection, error, dismissError);
  const catalog = toCatalog(models);
  const last = messages.at(-1);
  // Sent, accepted, but no token yet: the agent is working.
  const thinking = run === "running" && last?.role === "user";
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <ScrollToEndOnSend lastMessage={last} />
            <MessageList
              messages={messages}
              isLoading={isLoading}
              thinking={thinking}
              onRetry={(id) => void retry(id)}
            />
          </MessageScrollerViewport>
          {/* Shows only when scrolled away from the latest message; scrolls back on click. */}
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <Prompts
        usage={usage}
        run={run}
        approval={approval}
        prompt={prompt}
        sleeping={sleeping}
        beforeComposer={beforeComposer}
        attachments={attachments}
        catalog={catalog}
        modelId={modelId}
        reasoningEffort={reasoningEffort}
        send={send}
        onStop={() => void stop()}
        onAnswer={(text) => void answer(text)}
        onApprove={() => void approve()}
        onReject={() => void reject()}
        chooseModel={chooseModel}
      />
    </div>
  );
}
