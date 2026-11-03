"use client";

import { ClockIcon } from "lucide-react";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

export function SleepingItem({
  sleeping,
}: {
  sleeping: { until: number; reason: string };
}) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <ClockIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          Waiting until{" "}
          {new Date(sleeping.until).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </ItemTitle>
        {sleeping.reason && (
          <ItemDescription>{sleeping.reason}</ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
