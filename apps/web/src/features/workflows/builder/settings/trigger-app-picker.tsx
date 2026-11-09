"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLogo } from "@/features/connect/components/app-logo";
import { useCatalog } from "@/features/connect/use-catalog";

/** Which app's event starts the workflow: only apps that have events, as a searchable grid of tiles. */
export function TriggerAppPicker({
  onPick,
}: {
  onPick: (toolkit: string) => void;
}) {
  const [query, setQuery] = useState("");
  const catalog = useCatalog({
    q: query,
    category: null,
    slugs: null,
    withTriggers: true,
  });
  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps (Slack, Gmail, GitHub…)"
          aria-label="Search apps"
          maxLength={80}
        />
      </InputGroup>
      {catalog.total > 0 && (
        <p className="text-muted-foreground text-xs">
          {catalog.total.toLocaleString()} apps with events
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {catalog.items.map((app) => (
          <button
            type="button"
            key={app.slug}
            onClick={() => onPick(app.slug)}
            className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 text-left transition-colors hover:border-ring hover:bg-muted focus-visible:border-ring focus-visible:outline-none"
          >
            <AppLogo src={app.logo} name={app.name} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-sm">
                {app.name}
              </span>
              <span className="block text-muted-foreground text-xs">
                {app.triggersCount} event{app.triggersCount === 1 ? "" : "s"}
              </span>
            </span>
          </button>
        ))}
        {catalog.loading &&
          catalog.items.length === 0 &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
      </div>
      {!catalog.loading && catalog.items.length === 0 && (
        <p className="py-2 text-muted-foreground text-sm">
          {catalog.error ?? "No apps with events match."}
        </p>
      )}
      {catalog.hasMore && (
        <Button
          variant="ghost"
          size="sm"
          disabled={catalog.loading}
          onClick={catalog.loadMore}
        >
          {catalog.loading ? "Loading…" : "Show more apps"}
        </Button>
      )}
    </div>
  );
}
