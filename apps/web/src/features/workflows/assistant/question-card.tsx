"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authorizeApp } from "@/features/connect/api";
import { AppLogo } from "@/features/connect/components/app-logo";
import { type AssistantRun, answerRun } from "./api";
import { useAssistant } from "./store";

/**
 * What the assistant waits for: connecting apps, or a yes/no before it turns a workflow on or shares it with bots.
 * Connecting opens in a new tab, so this chat and the canvas stay as they are.
 */
export function QuestionCard({ run }: { run: AssistantRun }) {
  const [busy, setBusy] = useState(false);
  const q = run.question;
  if (!q) return null;

  const answer = async (approved: boolean) => {
    setBusy(true);
    try {
      await answerRun(run.id, approved);
      await useAssistant.getState().refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connect = async (toolkit: string) => {
    try {
      window.open(
        await authorizeApp(toolkit, window.location.pathname),
        "_blank",
        "noopener",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <p>{q.question ?? "The assistant needs your answer."}</p>
      {q.kind === "connect_apps" && q.apps && (
        <ul className="flex flex-col gap-1.5">
          {q.apps.map((a) => (
            <li key={a.toolkit} className="flex items-center gap-2">
              <AppLogo src={a.logo} name={a.name} size="sm" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => void connect(a.toolkit)}
              >
                Connect
                <ExternalLinkIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void answer(true)}>
          {q.kind === "connect_apps"
            ? "I've connected them"
            : q.action === "turn_on"
              ? "Turn on"
              : q.action === "test"
                ? "Run the test"
                : "Yes, go ahead"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void answer(false)}
        >
          {q.kind === "connect_apps" ? "Skip" : "Not now"}
        </Button>
      </div>
    </div>
  );
}
