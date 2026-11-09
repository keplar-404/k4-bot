"use client";

import { Button } from "@/components/ui/button";
import { deliveryLabel } from "./event-picker";
import type { TriggerType } from "./tools-api";

/** The chosen event: its name, how quickly it arrives, what it means, and a way to pick another. */
export function EventChosen({
  type,
  trigger,
  onChange,
}: {
  type: TriggerType | null;
  trigger: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium text-sm">{type?.name ?? trigger}</p>
        {type && (
          <p className="text-muted-foreground text-xs">
            {deliveryLabel(type.delivery)}
          </p>
        )}
        {type?.description && (
          <p className="mt-1 text-muted-foreground text-xs">
            {type.description}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}
