"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLogo } from "@/features/connect/components/app-logo";
import { useCatalog } from "@/features/connect/use-catalog";
import { useBuilder } from "../store";
import { LibraryItem, LibrarySection } from "./library-item";

/** All Composio apps (most used first), searched with the library's search box. */
export function LibraryApps({ query }: { query: string }) {
  const addBlock = useBuilder((s) => s.addBlock);
  const catalog = useCatalog({ q: query, category: null, slugs: null });
  return (
    <LibrarySection
      title={`Apps${catalog.total ? ` · ${catalog.total.toLocaleString()}` : ""}`}
    >
      {catalog.items.map((app) => (
        <LibraryItem
          key={app.slug}
          payload={{ kind: "action.app", toolkit: app.slug }}
          icon={<AppLogo src={app.logo} name={app.name} size="sm" />}
          title={app.name}
          hint={`${app.toolsCount.toLocaleString()} actions`}
          onAdd={() => addBlock("action.app", { toolkit: app.slug })}
        />
      ))}
      {catalog.loading &&
        catalog.items.length === 0 &&
        [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mx-2 my-1 h-8" />)}
      {!catalog.loading && catalog.items.length === 0 && (
        <p className="px-2 py-3 text-muted-foreground text-sm">
          {catalog.error ?? "No apps match."}
        </p>
      )}
      {catalog.hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mx-2 my-1"
          disabled={catalog.loading}
          onClick={catalog.loadMore}
        >
          {catalog.loading ? "Loading…" : "Show more apps"}
        </Button>
      )}
    </LibrarySection>
  );
}
