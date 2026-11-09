"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockBody } from "../blocks";
import { Field, SettingsSection } from "./field";

type DelayBlock = Extract<BlockBody, { kind: "logic.delay" }>;
const UNITS = ["seconds", "minutes", "hours", "days"] as const;

/** Delay: wait, then go on (up to 7 days; a waiting run costs nothing). */
export function DelaySettings({
  block,
  update,
}: {
  block: DelayBlock;
  update: (b: DelayBlock) => void;
}) {
  const seconds =
    block.config.amount *
    { seconds: 1, minutes: 60, hours: 3600, days: 86400 }[block.config.unit];
  return (
    <SettingsSection title="Wait for">
      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <Field id="delay-amount" label="Amount">
          <Input
            id="delay-amount"
            type="number"
            min={1}
            value={block.config.amount}
            onChange={(e) =>
              update({
                ...block,
                config: {
                  ...block.config,
                  amount: Math.max(
                    1,
                    Math.min(10000, Number.parseInt(e.target.value, 10) || 1),
                  ),
                },
              })
            }
          />
        </Field>
        <Field id="delay-unit" label="Unit">
          <Select
            value={block.config.unit}
            onValueChange={(v) =>
              update({
                ...block,
                config: { ...block.config, unit: v as (typeof UNITS)[number] },
              })
            }
          >
            <SelectTrigger id="delay-unit" className="w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u} className="capitalize">
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {seconds > 7 * 86400 && (
        <p className="text-destructive text-xs">
          A delay can be at most 7 days.
        </p>
      )}
    </SettingsSection>
  );
}
