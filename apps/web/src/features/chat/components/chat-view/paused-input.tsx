"use client";

import type { Prompt } from "@/features/chat/lib/stream/types";
import { AgentQuestion } from "./agent-question";
import { ModeSwitchItem } from "./mode-switch-item";
import { SecretRequestItem } from "./secret-request-item";

/** What a run waiting for the user's input shows: a mode switch, a secure secret form, or a question. */
export function PausedInput({
  prompt,
  onAnswer,
}: {
  prompt: Prompt;
  onAnswer: (text: string) => void;
}) {
  if (prompt.kind === "mode_switch") {
    return (
      <ModeSwitchItem
        key={prompt.runId}
        to={prompt.to}
        reason={prompt.reason}
        plan={prompt.plan}
        // The server saves the mode when it receives this answer and tells every tab (thread.mode), so the picker follows.
        onSwitch={(mode) => onAnswer(`switched:${mode}`)}
        onStay={() => onAnswer("stay")}
      />
    );
  }
  if (prompt.kind === "secret" && prompt.name) {
    return (
      <SecretRequestItem
        key={prompt.runId}
        name={prompt.name}
        label={prompt.label ?? prompt.name}
        why={prompt.why}
        onDone={(saved) => onAnswer(saved ? "saved" : "cancelled")}
      />
    );
  }
  return (
    <AgentQuestion
      key={prompt.runId}
      question={prompt.question}
      kind={prompt.kind}
      onAnswer={onAnswer}
    />
  );
}
