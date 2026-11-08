"use client";

import type { ReactNode } from "react";
import PromptBar from "@/features/chat/components/prompt-bar";
import type { useAttachments } from "@/features/chat/hooks/use-attachments";
import type { FileRef } from "@/features/chat/lib/protocol";
import type { ChatUsage, Prompt } from "@/features/chat/lib/stream/types";
import { ApprovalItem } from "./approval-item";
import type { toCatalog } from "./catalog";
import { PausedInput } from "./paused-input";
import { SleepingItem } from "./sleeping-item";
import { UsageMeter } from "./usage-meter";

export function Prompts({
  run,
  approval,
  prompt,
  sleeping,
  beforeComposer,
  attachments,
  catalog,
  modelId,
  reasoningEffort,
  send,
  onStop,
  onAnswer,
  onApprove,
  onReject,
  chooseModel,
  mode,
  onModeChange,
  usage,
}: {
  run: string;
  approval: {
    runId: string;
    actions: { name: string; args: Record<string, unknown> }[];
  } | null;
  prompt: Prompt | null;
  sleeping: { until: number; reason: string } | null;
  beforeComposer?: ReactNode;
  attachments: ReturnType<typeof useAttachments>;
  catalog: ReturnType<typeof toCatalog>;
  modelId: string | undefined;
  reasoningEffort: string | null | undefined;
  send: (text: string, files?: FileRef[]) => void | Promise<void>;
  onStop: () => void;
  onAnswer: (text: string) => void;
  onApprove: () => void;
  onReject: () => void;
  chooseModel: (key: string, effort: string | null) => void;
  mode?: "allow_all" | "plan" | "ask";
  onModeChange?: (mode: "allow_all" | "plan" | "ask") => void;
  usage: ChatUsage | null;
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {run === "waiting_approval" && approval && (
        <ApprovalItem
          actions={approval.actions}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {run === "waiting_input" && prompt && (
        <PausedInput prompt={prompt} onAnswer={onAnswer} />
      )}

      {run === "sleeping" && sleeping && <SleepingItem sleeping={sleeping} />}

      {beforeComposer}

      <PromptBar
        onSend={(text) => {
          void send(text, attachments.files);
          attachments.clear();
        }}
        attachments={attachments.items}
        onAttach={attachments.add}
        onRemoveAttachment={attachments.remove}
        responding={run !== "idle" && run !== "done" && run !== "failed"}
        onStop={onStop}
        busy={
          attachments.uploading ||
          (run !== "idle" && run !== "done" && run !== "failed")
        }
        models={catalog.length > 0 ? catalog : undefined}
        modelKey={modelId}
        effort={reasoningEffort}
        onSelect={chooseModel}
        mode={mode}
        onModeChange={onModeChange}
      />
      <UsageMeter
        usage={usage}
        contextLength={
          catalog.find((m) => m.key === modelId)?.contextLength ??
          catalog[0]?.contextLength
        }
      />
    </div>
  );
}
