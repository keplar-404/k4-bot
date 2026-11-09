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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBots } from "@/features/bots/hooks/use-bots";
import { ShareBotRow } from "@/features/workflows/builder/top-bar/share-bot-row";
import type { Group } from "./api";
import { useGroupForm } from "./use-group-form";

/** Create a group, or edit one (`group`): its name, its bots, the lead, and the notes every member reads. */
export function GroupDialog({
  open,
  onOpenChange,
  group,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  onSaved: (g: Group) => void;
}) {
  const { bots } = useBots();
  const f = useGroupForm(open, group, onSaved);
  const chosen = bots.filter((b) => f.botIds.includes(b.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? "Group settings" : "New group"}</DialogTitle>
          <DialogDescription>
            Bots in a group share one chat. The lead answers your messages;
            write @bot:name to ask a specific bot. They can pass work to each
            other.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name" className="text-xs">
              Name
            </Label>
            <Input
              id="group-name"
              maxLength={60}
              value={f.name}
              onChange={(e) => f.setName(e.target.value)}
              placeholder="Launch team"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Bots</span>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {bots.map((b) => (
                <ShareBotRow
                  key={b.id}
                  bot={b}
                  shared={f.botIds.includes(b.id)}
                  disabled={f.saving}
                  onToggle={() => f.toggle(b.id)}
                  toggleLabel="Add to group:"
                />
              ))}
            </ul>
          </div>
          {chosen.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-lead" className="text-xs">
                Lead (answers messages that name no bot)
              </Label>
              <Select
                value={f.lead}
                onValueChange={(v) => f.setLeadBotId(v ?? "")}
              >
                <SelectTrigger id="group-lead" className="w-full">
                  <SelectValue>
                    {chosen.find((b) => b.id === f.lead)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {chosen.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {group && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-notes" className="text-xs">
                Group notes (every member reads them; the bots update them too)
              </Label>
              <Textarea
                id="group-notes"
                maxLength={4000}
                rows={4}
                value={f.memory}
                onChange={(e) => f.setMemory(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          {f.problem && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              {f.problem}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(f.problem) || f.saving}
            onClick={() => void f.save()}
          >
            {group ? "Save" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
