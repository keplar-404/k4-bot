"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBots } from "@/features/bots/hooks/use-bots";
import { Field } from "./field";

/** Which of the user's bots does an AI step. */
export function BotPicker({
  botId,
  onPick,
}: {
  botId: string | undefined;
  onPick: (botId: string | undefined) => void;
}) {
  const { bots } = useBots();
  return (
    <Field
      id="ai-bot"
      label="Who does it"
      required
      hint="The bot answers with its own memory of you and your business."
    >
      <Select value={botId ?? ""} onValueChange={(v) => onPick(v || undefined)}>
        <SelectTrigger id="ai-bot" className="w-full">
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
    </Field>
  );
}
