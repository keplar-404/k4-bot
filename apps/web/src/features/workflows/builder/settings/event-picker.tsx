"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTriggers, type TriggerType } from "./tools-api";

/** How quickly an event arrives, in words: pushed by the app at once, or checked on a timer by Composio. */
export const deliveryLabel = (delivery: string) =>
  delivery === "poll" ? "Checked every few minutes" : "Instant";

/** Every event an app can start a workflow with. */
export function EventPicker({
  toolkit,
  onPick,
}: {
  toolkit: string;
  onPick: (t: TriggerType) => void;
}) {
  const [events, setEvents] = useState<TriggerType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents(null);
    setError(null);
    fetchTriggers(toolkit).then(setEvents, (e: Error) => setError(e.message));
  }, [toolkit]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (events === null)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  if (events.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        This app has no events that can start a workflow. Use a schedule that
        checks it instead, or another app.
      </p>
    );
  return (
    <div className="flex max-h-72 flex-col overflow-y-auto rounded-lg border">
      {events.map((t) => (
        <button
          type="button"
          key={t.slug}
          onClick={() => onPick(t)}
          className="flex flex-col gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{t.name}</span>
            <Badge variant="outline" className="shrink-0 font-normal">
              {deliveryLabel(t.delivery)}
            </Badge>
          </span>
          <span className="line-clamp-2 text-muted-foreground text-xs">
            {t.description}
          </span>
        </button>
      ))}
    </div>
  );
}
