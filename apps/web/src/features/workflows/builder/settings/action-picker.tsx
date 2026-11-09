"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTools, type ToolSummary } from "./tools-api";

/** Every action the app offers, searchable; picking one pins its current version. */
export function ActionPicker({
  toolkit,
  onPick,
}: {
  toolkit: string;
  onPick: (t: ToolSummary) => void;
}) {
  const [tools, setTools] = useState<ToolSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setTools(null);
    fetchTools(toolkit)
      .then(setTools)
      .catch((e: Error) => setError(e.message));
  }, [toolkit]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tools ?? [])
      .filter(
        (t) => !q || `${t.name} ${t.description}`.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [tools, query]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tools ? `Search ${tools.length} actions` : "Loading actions…"
          }
          aria-label="Search actions"
        />
      </InputGroup>
      <div className="flex max-h-96 flex-col overflow-y-auto rounded-lg border pt-2">
        {tools === null
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="m-2 h-9" />)
          : shown.map((t) => (
              <button
                type="button"
                key={t.slug}
                onClick={() => onPick(t)}
                className="flex flex-col gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="font-medium text-sm">{t.name}</span>
                <span className="line-clamp-2 text-muted-foreground text-xs">
                  {t.description}
                </span>
              </button>
            ))}
        {tools !== null && shown.length === 0 && (
          <p className="p-3 text-muted-foreground text-sm">No actions match.</p>
        )}
      </div>
    </div>
  );
}
