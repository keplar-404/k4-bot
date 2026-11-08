"use client";

import type { ReactNode } from "react";
import { DRAG_TYPE, type DragPayload } from "../flow-theme";

/**
 * A block in the library: click adds it after the selected block (or the last one), drag drops it where you let go.
 * `aria-label` says what clicking does, for keyboard and screen-reader users.
 */
export function LibraryItem({
  payload,
  icon,
  title,
  hint,
  onAdd,
}: {
  payload: DragPayload;
  icon: ReactNode;
  title: string;
  hint?: string;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onAdd}
      aria-label={`Add ${title}`}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">{title}</span>
        {hint && (
          <span className="block truncate text-muted-foreground text-xs">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

/** A titled group of library items. */
export function LibrarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}
