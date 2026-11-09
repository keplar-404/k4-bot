"use client";

import { AlarmClockIcon } from "lucide-react";
import { describeSchedule } from "@/features/schedules/describe";
import type { Task } from "./api";
import { TaskActions } from "./task-actions";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

/** One task: name, bot, schedule, next run, the last problem, and its controls. */
export function TaskRow({
  task,
  botName,
  busy,
  onToggle,
  onRun,
  onEdit,
  onDelete,
}: {
  task: Task;
  botName: string;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const next = task.status === "active" ? when(task.nextRunAt) : null;
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{task.title}</p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {botName} · {describeSchedule(task.schedule)} (
          {task.schedule.timezone})
          {task.createdByBot ? " · made by the bot" : ""}
        </p>
        <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
          {task.prompt}
        </p>
        <p className="mt-1 text-xs">
          {next
            ? `Next: ${next}`
            : task.status === "paused"
              ? "Off"
              : "No next run"}
          {task.lastRunAt ? ` · last ran ${when(task.lastRunAt)}` : ""}
        </p>
        {task.lastError && (
          <p className="mt-1 text-amber-700 text-xs dark:text-amber-400">
            {task.lastError}
          </p>
        )}
      </div>
      <TaskActions
        task={task}
        busy={busy}
        onToggle={onToggle}
        onRun={onRun}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  );
}

export function NoTasks() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
      <AlarmClockIcon className="size-6" />
      No scheduled tasks yet.
    </div>
  );
}
