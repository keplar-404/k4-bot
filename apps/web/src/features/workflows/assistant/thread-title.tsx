"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { renameThread } from "./api";
import { useAssistant } from "./store";

/** The chat's name in the panel header: click to rename (Enter saves, Esc cancels). */
export function ThreadTitle() {
  const thread = useAssistant((s) => s.thread);
  const [editing, setEditing] = useState<string | null>(null);

  if (!thread)
    return (
      <span className="min-w-0 flex-1 truncate px-1 font-medium text-sm">
        Assistant
      </span>
    );
  if (editing === null)
    return (
      <button
        type="button"
        title="Rename this chat"
        className="min-w-0 flex-1 truncate rounded px-1 text-left font-medium text-sm hover:bg-muted"
        onClick={() => setEditing(thread.title)}
      >
        {thread.title}
      </button>
    );

  const save = async () => {
    const title = editing.trim();
    setEditing(null);
    if (!title || title === thread.title) return;
    try {
      await renameThread(thread.id, title);
      await useAssistant.getState().refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Input
      autoFocus
      aria-label="Chat name"
      className="h-7 min-w-0 flex-1 text-sm"
      value={editing}
      maxLength={80}
      placeholder="e.g. Gmail digest"
      onChange={(e) => setEditing(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") void save();
        if (e.key === "Escape") {
          e.stopPropagation();
          setEditing(null);
        }
      }}
    />
  );
}
