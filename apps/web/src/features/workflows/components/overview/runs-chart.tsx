"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DailyRuns } from "../../api";

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Runs per day for the last 14 days, all workflows together. One series, so no legend: the title names it. Thin
 * bars anchored to the baseline with a 2px gap; each day has a hover tooltip (whole column as the hit target).
 */
export function RunsChart({ daily }: { daily: DailyRuns[] }) {
  const max = Math.max(1, ...daily.map((d) => d.total));
  const total = daily.reduce((n, d) => n + d.total, 0);
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      aria-label="Runs per day, last 14 days"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium text-sm">Runs per day</h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {total.toLocaleString()} in 14 days
        </span>
      </div>
      <div className="flex h-28 items-end gap-0.5 border-border border-b">
        {daily.map((d) => (
          <Tooltip key={d.day}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="group flex h-full flex-1 cursor-default items-end justify-center outline-none"
                  aria-label={`${dayLabel(d.day)}: ${d.total} runs, ${d.failed} failed`}
                />
              }
            >
              <span
                className="w-full max-w-6 rounded-t-[4px] bg-chart-2 transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                style={{
                  height: d.total
                    ? `${Math.max(4, (d.total / max) * 100)}%`
                    : "2px",
                  opacity: d.total ? 1 : 0.35,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{dayLabel(d.day)}</p>
              <p className="tabular-nums">
                {d.total} run{d.total === 1 ? "" : "s"} · {d.succeeded}{" "}
                succeeded · {d.failed} failed
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
        <span>{daily[0] ? dayLabel(daily[0].day) : ""}</span>
        <span>Today</span>
      </div>
    </section>
  );
}
