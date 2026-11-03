"use client";

import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

function Chip({
  label,
  hint,
  selected,
  onToggle,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={hint}
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition hover:bg-muted ${
        selected
          ? "border-primary bg-primary/10 text-foreground"
          : "text-muted-foreground"
      }`}
    >
      {selected && <CheckIcon className="size-3" />}
      {label}
    </button>
  );
}

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/** One group of the picker (skills or apps): a heading with a browse button, then a chip per installed item. */
export function PickerSection({
  icon,
  title,
  browseLabel,
  onBrowse,
  empty,
  items,
  selected,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  browseLabel: string;
  onBrowse: () => void;
  empty: ReactNode;
  items: { id: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="flex w-full items-center justify-between text-sm font-medium">
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <Button type="button" size="xs" variant="ghost" onClick={onBrowse}>
          {browseLabel}
        </Button>
      </legend>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              hint={item.hint}
              selected={selected.includes(item.id)}
              onToggle={() => onChange(toggle(selected, item.id))}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}
