"use client";

import { WEEKDAYS } from "./describe";

/** Which days of the week (0 = Sunday), as toggle buttons. */
export function ScheduleWeekdays({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs">On</legend>
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map((name, day) => {
          const on = days.includes(day);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? days.filter((d) => d !== day) : [...days, day])
              }
              className={`h-8 min-w-11 rounded-md border px-2 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
