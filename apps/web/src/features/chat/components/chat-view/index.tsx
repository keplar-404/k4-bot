"use client";
import type { ReactNode } from "react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Button } from "@/components/ui/button";
import { useBots } from "@/features/bots/hooks/use-bots";
import { continueRun as resumeThread } from "@/features/chat/lib/client/threads";
import { toast } from "sonner";
import type { Source } from "@/features/chat/components/prompt-bar/data";
import { useAttachments } from "@/features/chat/hooks/use-attachments";
import { useChat } from "@/features/chat/hooks/use-chat";
import { type Group, mentionKey } from "@/features/groups/api";
import { toCatalog } from "./catalog";
import { MessageList } from "./message-list";
import { Prompts } from "./prompts";
import { ScrollToEndOnSend } from "./scroll-to-end";
import { TodoPanel } from "./todo-panel";
import { useChatEffects } from "./use-effects";

/** In a group chat "@" offers its bots first, written as @bot:name (only group chats route by them). */
const botMentions = (group: Group): Source[] =>
  group.members.map((m) => ({
    key: `bot:${m.id}`,
    name: `bot:${mentionKey(m.name)}`,
    desc: `${m.name}${m.id === group.leadBotId ? " · lead" : ""}`,
    section: "Bots",
    glyph: "bot",
  }));
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
  group,
}: {
  /** A group chat: its bots answer here; `botId` is its lead. */
  group?: Group;
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
    getThreadId,
    connection,
    error,
    isLoading,
    models,
    modelId,
    reasoningEffort,
    mode,
    setMode,
    chooseModel,
    send,
    retry,
    dismissError,
    approve,
    reject,
  } = useChat(botId, group?.id);
  const attachments = useAttachments(botId);
  const { bots } = useBots();
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
              authorOf={(m) => bots.find((b) => b.id === (m.botId ?? botId))}
              group={Boolean(group)}
            />
          </MessageScrollerViewport>
          {/* Shows only when scrolled away from the latest message; scrolls back on click. */}
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      {run === "failed" && (
        <div className="flex justify-center pb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const id = getThreadId();
              if (!id) return;
              void resumeThread(id).then(
                () => window.location.reload(),
                (e: Error) => toast.error(e.message),
              );
            }}
          >
            Continue from where it stopped
          </Button>
        </div>
      )}
      <Prompts
        usage={usage}
        run={run}
        approval={approval}
        prompt={prompt}
        sleeping={sleeping}
        beforeComposer={
          <>
            <TodoPanel
              messages={messages}
              working={run !== "idle" && run !== "done" && run !== "failed"}
            />
            {beforeComposer}
          </>
        }
        attachments={attachments}
        catalog={catalog}
        modelId={modelId}
        reasoningEffort={reasoningEffort}
        mode={mode}
        send={send}
        onStop={() => void stop()}
        onAnswer={(text) => void answer(text)}
        onApprove={() => void approve()}
        onReject={() => void reject()}
        chooseModel={chooseModel}
        onModeChange={(m) => void setMode(m)}
        mentionExtras={group ? botMentions(group) : undefined}
      />
    </div>
  );
}
