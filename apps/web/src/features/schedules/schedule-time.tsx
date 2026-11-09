"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleConfig } from "./describe";

/** The date (once), the day of the month (monthly) and the time of day. */
export function ScheduleTime({
  value,
  onChange,
  idPrefix,
}: {
  value: ScheduleConfig;
  onChange: (patch: Partial<ScheduleConfig>) => void;
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {value.mode === "once" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("date")} className="text-xs">
              Date
            </Label>
            <Input
              id={id("date")}
              type="date"
              value={value.date ?? ""}
              onChange={(e) => onChange({ date: e.target.value || undefined })}
            />
          </div>
        )}
        {value.mode === "monthly" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("dom")} className="text-xs">
              Day of the month
            </Label>
            <Input
              id={id("dom")}
              type="number"
              min={1}
              max={31}
              value={value.dayOfMonth}
              onChange={(e) =>
                onChange({
                  dayOfMonth: Math.min(
                    31,
                    Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                  ),
                })
              }
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("at")} className="text-xs">
            Time
          </Label>
          <Input
            id={id("at")}
            type="time"
            value={value.at}
            onChange={(e) => e.target.value && onChange({ at: e.target.value })}
          />
        </div>
      </div>
      {value.mode === "monthly" && value.dayOfMonth > 28 && (
        <p className="text-muted-foreground text-xs">
          In shorter months it runs on the last day.
        </p>
      )}
    </>
  );
}
