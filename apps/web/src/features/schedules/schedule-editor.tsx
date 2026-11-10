"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleConfig } from "./describe";
import { ScheduleEvery } from "./schedule-every";
import { ScheduleTime } from "./schedule-time";
import { ScheduleWeekdays } from "./schedule-weekdays";

const MODES: Array<[ScheduleConfig["mode"], string]> = [
  ["once", "Once"],
  ["daily", "Every day"],
  ["weekly", "Every week"],
  ["monthly", "Every month"],
  ["every", "Every few minutes or hours"],
];

/** When something runs: once, daily, weekly (which days), monthly (which day) or an interval, in a time zone. */
export function ScheduleEditor({
  value,
  onChange,
  idPrefix = "sched",
}: {
  value: ScheduleConfig;
  onChange: (s: ScheduleConfig) => void;
  idPrefix?: string;
}) {
  const set = (patch: Partial<ScheduleConfig>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-mode`} className="text-xs">
          Repeats
        </Label>
        <Select
          value={value.mode}
          onValueChange={(v) => set({ mode: v as ScheduleConfig["mode"] })}
        >
          <SelectTrigger id={`${idPrefix}-mode`} className="w-full">
            <SelectValue>
              {MODES.find(([m]) => m === value.mode)?.[1]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MODES.map(([mode, label]) => (
              <SelectItem key={mode} value={mode}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.mode === "every" ? (
        <ScheduleEvery value={value} onChange={set} idPrefix={idPrefix} />
      ) : (
        <>
          {value.mode === "weekly" && (
            <ScheduleWeekdays
              days={value.days}
              onChange={(days) => set({ days })}
            />
          )}
          <ScheduleTime value={value} onChange={set} idPrefix={idPrefix} />
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-tz`} className="text-xs">
          Time zone
        </Label>
        <Input
          id={`${idPrefix}-tz`}
          value={value.timezone}
          maxLength={64}
          placeholder="Your city zone, e.g. Asia/Dhaka"
          onChange={(e) => set({ timezone: e.target.value })}
        />
      </div>
    </div>
  );
}
