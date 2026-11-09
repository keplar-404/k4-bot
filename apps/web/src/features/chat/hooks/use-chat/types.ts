import type { Bot } from "@/features/bots/api";
import type { MessageRow, ModelRow } from "@/features/chat/lib/client";
import type { OutboxItem } from "@/features/chat/lib/outbox";
import type {
  ChatErrorInfo,
  ChatMessageView,
  FileRef,
} from "@/features/chat/lib/protocol";
import type { StreamState } from "@/features/chat/lib/stream";
import type { useChatState } from "./state";

export type ChatState = ReturnType<typeof useChatState>;

export type ThreadSummary = { id: string };

export type ChatCtx = ChatState & {
  botId: string;
  /** Set in a group chat: the thread is the group's, and `botId` is its lead. */
  groupId?: string;
  FATAL: Set<string>;
  toInfo: (err: unknown) => ChatErrorInfo;
  networkError: () => ChatErrorInfo;
  initialStreamState: (
    messages?: ChatMessageView[],
    cursor?: number,
  ) => StreamState;
  listThreads: (
    botId: string,
    groupId?: string,
  ) => Promise<{ threads: ThreadSummary[] }>;
  listModels: () => Promise<{ models: ModelRow[]; defaultModel: string }>;
  fetchBot: (botId: string) => Promise<{ ok: boolean; bot?: Bot }>;
  readOutbox: (threadId: string) => OutboxItem[];
  backoffMs: (n: number) => number;
  canRetry: (item: OutboxItem) => boolean;
  rowsToViews: (rows: MessageRow[]) => ChatMessageView[];
  reload: () => Promise<void>;
  persistOutbox: (threadId: string, items: OutboxItem[]) => void;
  connect: (threadId: string) => Promise<void>;
  loadHistory: (threadId: string) => Promise<void>;
  deliver: (
    threadId: string,
    content: string,
    messageId: string,
    rerun?: boolean,
    files?: FileRef[],
  ) => Promise<void>;
  send: (text: string, files?: FileRef[]) => Promise<void>;
  retry: (messageId: string, manual?: boolean) => Promise<void>;
  flush: () => Promise<void>;
  decide: (type: "approve" | "reject") => Promise<void>;
  answer: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  dismissError: () => void;
  approve: () => void;
  reject: () => void;
  select: (id: string, effort: string | null) => void;
  chooseModel: (id: string, effort: string | null) => void;
  ctxRef: { current: ChatCtx | null };
};
