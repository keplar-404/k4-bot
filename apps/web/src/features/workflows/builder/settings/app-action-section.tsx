"use client";

import { Button } from "@/components/ui/button";
import type { ToolDetail } from "./tools-api";

/** The chosen action row: name, description, and a Change button. */
export function AppActionChosen({
  detail,
  tool,
  onChange,
}: {
  detail: ToolDetail | null;
  tool: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium text-sm">{detail?.name ?? tool}</p>
        {detail?.description && (
          <p className="line-clamp-3 text-muted-foreground text-xs">
            {detail.description}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}
