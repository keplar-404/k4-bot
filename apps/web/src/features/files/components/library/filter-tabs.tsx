import { Button } from "@/components/ui/button";

export const FILTERS = [
  { key: "all", label: "All" },
  { key: "upload", label: "Uploaded" },
  { key: "generated", label: "Created by bots" },
  { key: "computer", label: "From the computer" },
] as const;
export type Filter = (typeof FILTERS)[number]["key"];

/** The Files page's source filter. */
export function FilterTabs({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter files"
      className="flex flex-wrap gap-1"
    >
      {FILTERS.map((f) => (
        <Button
          key={f.key}
          role="tab"
          aria-selected={filter === f.key}
          size="sm"
          variant={filter === f.key ? "secondary" : "ghost"}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
