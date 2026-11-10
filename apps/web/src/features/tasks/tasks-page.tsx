"use client";

import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useBots } from "@/features/bots/hooks/use-bots";
import { deleteTask, runTaskNow, updateTask } from "./api";
import { useTasksStore } from "./store";
import { TaskDialog } from "./task-dialog";
import { NoTasks, TaskRow } from "./task-row";

const STARTED = "Started: open the chat to watch it.";
const INTRO =
  "A bot does a task at the times you choose (once, daily, weekly or monthly) and answers in its chat. You can also ask a bot in chat: “every morning at 8, send me the news”.";

/** Scheduled tasks (like Grok's Tasks): a bot does something at set times and answers in its chat. */
export function TasksPage() {
  const { bots } = useBots();
  const tasks = useTasksStore((s) => s.tasks);
  const editing = useTasksStore((s) => s.editing);
  const setEditing = useTasksStore((s) => s.setEditing);
  const busy = useTasksStore((s) => s.busy);
  const load = useTasksStore((s) => s.load);
  const act = useTasksStore((s) => s.act);
  useEffect(() => void load(), [load]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Tasks" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-muted-foreground text-sm">{INTRO}</p>
        <Button onClick={() => setEditing("new")} disabled={bots.length === 0}>
          <PlusIcon />
          New task
        </Button>
      </div>
      {tasks === null ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : tasks.length === 0 ? (
        <NoTasks />
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              botName={bots.find((b) => b.id === t.botId)?.name ?? "Bot"}
              busy={busy === t.id}
              onToggle={(on) =>
                void act(
                  t.id,
                  () => updateTask(t.id, { status: on ? "active" : "paused" }),
                  on ? "Task on." : "Task off.",
                )
              }
              onRun={() => void act(t.id, () => runTaskNow(t.id), STARTED)}
              onEdit={() => setEditing(t)}
              onDelete={() =>
                void act(t.id, () => deleteTask(t.id), "Task deleted.")
              }
            />
          ))}
        </div>
      )}
      <TaskDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        task={editing === "new" ? null : editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
