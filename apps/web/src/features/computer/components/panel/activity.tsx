import type { ActivityEvent } from "@/features/computer/api";
import { cn } from "@/lib/utils";

/**
 * What bots did on the computer, newest first. With `botId` (a bot's page) only that bot's own work is shown;
 * without it (the computer page) every bot's, each line named after its bot.
 */
export function Activity({
  events,
  botId,
  names,
  className,
}: {
  events: ActivityEvent[];
  botId?: string;
  names?: Record<string, string>;
  className?: string;
}) {
  const shown = (botId ? events.filter((e) => e.botId === botId) : events)
    .slice()
    .reverse();
  return (
    <ol className={cn("flex flex-col gap-1.5 overflow-y-auto", className)}>
      {shown.length === 0 && (
        <li className="text-xs text-muted-foreground">
          {botId
            ? "Nothing yet. What this bot does on the computer shows up here."
            : "Nothing yet. What your bots do on the computer shows up here."}
        </li>
      )}
      {shown.map((e) => (
        <li key={`${e.at}-${e.botId}-${e.text}`} className="flex gap-2 text-xs">
          <time className="shrink-0 tabular-nums text-muted-foreground">
            {new Date(e.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <span className="min-w-0 break-words">
            {!botId && (
              <span className="font-medium">
                {names?.[e.botId] ?? "A deleted bot"}:{" "}
              </span>
            )}
            {e.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
