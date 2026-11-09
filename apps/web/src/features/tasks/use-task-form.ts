"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  defaultSchedule,
  type ScheduleConfig,
} from "@/features/schedules/describe";
import { createTask, type Task, updateTask } from "./api";

/** The task dialog's fields, filled from `task` (or blank) each time it opens, and saving them. */
export function useTaskForm(
  open: boolean,
  task: Task | null,
  firstBotId: string | undefined,
  onSaved: (t: Task) => void,
) {
  const [botId, setBotId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [schedule, setSchedule] = useState<ScheduleConfig>(defaultSchedule());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBotId(task?.botId ?? firstBotId ?? "");
    setTitle(task?.title ?? "");
    setPrompt(task?.prompt ?? "");
    setSchedule(task?.schedule ?? defaultSchedule());
  }, [open, task, firstBotId]);

  /** True when saved. */
  const save = async () => {
    setBusy(true);
    try {
      const input = { title: title.trim(), prompt: prompt.trim(), schedule };
      const saved = task
        ? await updateTask(task.id, input)
        : await createTask(botId, input);
      toast.success(task ? "Task saved." : "Task scheduled.");
      onSaved(saved);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(title.trim() && prompt.trim() && (task || botId));
  return {
    botId,
    setBotId,
    title,
    setTitle,
    prompt,
    setPrompt,
    schedule,
    setSchedule,
    busy,
    ready,
    save,
  };
}
