"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether the computer panel is full screen. Escape closes it and focus moves to `closeRef` when it opens;
 * `canStay` false (the computer slept) closes it, since there is nothing left to show.
 */
export function useFullscreen(canStay: boolean) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!canStay) setOpen(false);
  }, [canStay]);

  return { open, setOpen, closeRef };
}
