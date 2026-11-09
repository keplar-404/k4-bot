"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBots } from "@/features/bots/hooks/use-bots";

/** Which bot does a task. */
export function BotSelect({
  botId,
  onChange,
}: {
  botId: string;
  onChange: (id: string) => void;
}) {
  const { bots } = useBots();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="task-bot" className="text-xs">
        Bot
      </Label>
      <Select value={botId} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger id="task-bot" className="w-full">
          <SelectValue placeholder="Choose a bot">
            {bots.find((b) => b.id === botId)?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {bots.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
