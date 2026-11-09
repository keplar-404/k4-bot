"use client";

import {
  MessageSquareIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Task } from "./api";

/** A task's controls: on / off, run now, open the bot's chat, edit, delete. */
export function TaskActions({
  task,
  busy,
  onToggle,
  onRun,
  onEdit,
  onDelete,
}: {
  task: Task;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Switch
        size="sm"
        checked={task.status === "active"}
        disabled={busy}
        onCheckedChange={onToggle}
        aria-label={`Turn ${task.title} ${task.status === "active" ? "off" : "on"}`}
      />
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={busy}
        onClick={onRun}
        aria-label="Run now"
        title="Run now"
      >
        <PlayIcon />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        nativeButton={false}
        render={<Link href={`/dashboard/bot/${task.botId}`} />}
        aria-label="Open the chat"
        title="Open the chat"
      >
        <MessageSquareIcon />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onEdit}
        aria-label="Edit"
        title="Edit"
      >
        <PencilIcon />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={busy}
        onClick={onDelete}
        aria-label="Delete"
        title="Delete"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
