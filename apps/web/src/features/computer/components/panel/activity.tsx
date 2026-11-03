import type { ActivityEvent } from "@/features/computer/api";
import { cn } from "@/lib/utils";

/** What the bots did on the computer, newest first; other bots' lines are dimmed. */
export function Activity({
  events,
  botId,
  className,
}: {
  events: ActivityEvent[];
  botId: string;
  className?: string;
}) {
  const shown = [...events].reverse();
  return (
    <ol className={cn("flex flex-col gap-1.5 overflow-y-auto", className)}>
      {shown.length === 0 && (
        <li className="text-xs text-muted-foreground">
          Nothing yet. What your bots do on the computer shows up here.
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
          <span
            className={cn(
              "min-w-0 break-words",
              e.botId !== botId && "text-muted-foreground",
            )}
          >
            {e.botId !== botId && "Another bot: "}
            {e.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
