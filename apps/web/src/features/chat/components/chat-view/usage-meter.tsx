"use client";

import type { ChatUsage } from "@/features/chat/lib/stream/types";
import { cn } from "@/lib/utils";

/** 1234 → "1.2k", 1048576 → "1M". */
const compact = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${+(n / 1000).toFixed(1)}k`
      : String(n);

/**
 * Under the composer: how full this chat's context is for the selected model (each model has its own window), and
 * today's tokens against the daily budget. Both update live after every model call while the agent works.
 */
export function UsageMeter({
  usage,
  contextLength,
}: {
  usage: ChatUsage | null;
  /** The selected model's context window: the next message is sent to it. */
  contextLength: number | undefined;
}) {
  const used = usage?.contextTokens ?? 0;
  const pct = contextLength
    ? Math.min(100, Math.round((used / contextLength) * 100))
    : 0;
  const level = pct >= 85 ? "danger" : pct >= 70 ? "warn" : "ok";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground tabular-nums">
      <div
        className="flex items-center gap-2"
        title={
          contextLength
            ? `${used.toLocaleString()} of ${contextLength.toLocaleString()} tokens`
            : undefined
        }
      >
        <span>Context</span>
        <span
          className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <span
            className={cn(
              "block h-full rounded-full bg-foreground/40 transition-[width]",
              level === "warn" && "bg-amber-500",
              level === "danger" && "bg-destructive",
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span>
          {compact(used)}
          {contextLength ? ` / ${compact(contextLength)} · ${pct}%` : ""}
        </span>
        {(usage?.cachedTokens ?? 0) > 0 && (
          <span title="Input tokens read from the model provider's prompt cache on the last call: cheaper and faster">
            · {compact(usage?.cachedTokens ?? 0)} cached
          </span>
        )}
        {level !== "ok" && (
          <span
            className={
              level === "danger" ? "text-destructive" : "text-amber-500"
            }
          >
            Type /compact to free space
          </span>
        )}
      </div>
      {usage && (
        <span title="Tokens your bots used today; resets at 00:00 UTC">
          Today {compact(usage.todayUsed)} / {compact(usage.todayLimit)} ·{" "}
          {compact(Math.max(0, usage.todayLimit - usage.todayUsed))} left
        </span>
      )}
    </div>
  );
}
