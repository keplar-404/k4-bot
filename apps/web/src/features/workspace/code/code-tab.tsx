"use client";

import {
  CodeIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteSandboxDialog } from "@/features/sandboxes/delete-sandbox-dialog";
import { useWorkspace } from "../use-workspace";
import { SandboxDetails } from "./sandbox-details";
import { useBotSandbox } from "./use-bot-sandbox";

/** This bot's code sandbox: its state and purpose, Start / Pause / Delete, and the way into the code editor. */
export function CodeTab({ botId }: { botId: string }) {
  const { row, busy, reload, start, pause, remove } = useBotSandbox(botId);
  const { setEditorOpen } = useWorkspace();
  const [confirm, setConfirm] = useState(false);

  if (row === undefined)
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (row === null) {
    return (
      <div className="flex flex-col gap-2 p-4 text-sm text-muted-foreground">
        <p>This bot has no sandbox yet.</p>
        <p>
          A coding bot creates one when it starts writing code (ask it to build
          something). Each bot has at most one.
        </p>
      </div>
    );
  }
  const running = row.status === "running";
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Sandbox</span>
        <Badge variant={running ? "default" : "secondary"}>{row.status}</Badge>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          aria-label="Refresh"
          onClick={() => void reload()}
        >
          <RefreshCwIcon />
        </Button>
      </div>
      <SandboxDetails row={row} />
      <Button onClick={() => setEditorOpen(true)}>
        <CodeIcon />
        Open the code editor
      </Button>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void (running ? pause() : start())}
        >
          {busy ? (
            <Loader2Icon className="animate-spin" />
          ) : running ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          <Trash2Icon />
          Delete
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        It pauses by itself when no bot is working and the editor is closed.
        Files stay until you delete it.
      </p>
      <DeleteSandboxDialog
        row={confirm ? { ...row, botName: "This bot" } : null}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void remove();
        }}
      />
    </div>
  );
}
