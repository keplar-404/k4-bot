"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Block, BlockBody } from "../blocks";
import { Field, SettingsSection } from "./field";

type SchedBlock = Extract<BlockBody, { kind: "trigger.schedule" }>;
const UNITS = ["minutes", "hours", "days", "weeks"] as const;

/** Schedule settings: every N minutes/hours/days/weeks (min 5 min). */
export function ScheduleSettings({
  block,
  update,
}: {
  block: SchedBlock;
  update: (b: SchedBlock) => void;
}) {
  const { every, unit } = block.config;
  const minutes =
    every * { minutes: 1, hours: 60, days: 1440, weeks: 10080 }[unit];
  return (
    <SettingsSection title="Runs every">
      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <Field id="sched-every" label="Every">
          <Input
            id="sched-every"
            type="number"
            min={1}
            max={1000}
            value={every}
            onChange={(e) =>
              update({
                ...block,
                config: {
                  ...block.config,
                  every: Math.max(
                    1,
                    Math.min(1000, Number.parseInt(e.target.value, 10) || 1),
                  ),
                },
              })
            }
          />
        </Field>
        <Field id="sched-unit" label="Unit">
          <Select
            value={unit}
            onValueChange={(v) =>
              update({
                ...block,
                config: { ...block.config, unit: v as (typeof UNITS)[number] },
              })
            }
          >
            <SelectTrigger id="sched-unit" className="w-full capitalize">
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
      {minutes < 5 ? (
        <p className="text-destructive text-xs">
          A schedule runs at most every 5 minutes.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          The first run is one interval after you turn the workflow on.
        </p>
      )}
    </SettingsSection>
  );
}
