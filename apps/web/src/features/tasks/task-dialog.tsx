"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBots } from "@/features/bots/hooks/use-bots";
import { ScheduleEditor } from "@/features/schedules/schedule-editor";
import type { Task } from "./api";
import { BotSelect } from "./bot-select";
import { useTaskForm } from "./use-task-form";

/** Create a task, or edit one (`task`): which bot, what to do, and when. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSaved: (t: Task) => void;
}) {
  const { bots } = useBots();
  const f = useTaskForm(open, task, bots[0]?.id, onSaved);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New scheduled task"}</DialogTitle>
          <DialogDescription>
            At each time, the bot gets this as a message in its chat and does it
            with all its tools.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!task && <BotSelect botId={f.botId} onChange={f.setBotId} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title" className="text-xs">
              Name
            </Label>
            <Input
              id="task-title"
              maxLength={80}
              value={f.title}
              onChange={(e) => f.setTitle(e.target.value)}
              placeholder="Morning news brief"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-prompt" className="text-xs">
              What to do
            </Label>
            <Textarea
              id="task-prompt"
              rows={4}
              maxLength={4000}
              value={f.prompt}
              onChange={(e) => f.setPrompt(e.target.value)}
              placeholder="Find the 5 most important AI news of the last 24 hours and summarise each in two lines, with links."
            />
          </div>
          <ScheduleEditor
            value={f.schedule}
            onChange={f.setSchedule}
            idPrefix="task"
          />
          <p className="text-muted-foreground text-xs">
            At most once an hour. Each run counts toward your daily chat limit.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={f.busy || !f.ready}
            onClick={() =>
              void f.save().then((ok) => ok && onOpenChange(false))
            }
          >
            {task ? "Save" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
