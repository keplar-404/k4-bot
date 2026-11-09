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

const UNITS = ["minutes", "hours", "days", "weeks"] as const;

/** The interval fields: every N minutes / hours / days / weeks. */
export function ScheduleEvery({
  value,
  onChange,
  idPrefix,
}: {
  value: ScheduleConfig;
  onChange: (patch: Partial<ScheduleConfig>) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-every`} className="text-xs">
          Every
        </Label>
        <Input
          id={`${idPrefix}-every`}
          type="number"
          min={1}
          max={1000}
          value={value.every}
          onChange={(e) =>
            onChange({
              every: Math.max(
                1,
                Math.min(1000, Number.parseInt(e.target.value, 10) || 1),
              ),
            })
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-unit`} className="text-xs">
          Unit
        </Label>
        <Select
          value={value.unit}
          onValueChange={(v) => onChange({ unit: v as (typeof UNITS)[number] })}
        >
          <SelectTrigger id={`${idPrefix}-unit`} className="w-full capitalize">
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
      </div>
    </div>
  );
}
