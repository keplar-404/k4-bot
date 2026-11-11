"use client";

import { type PointerEvent, useCallback, useState } from "react";

const KEY = "workflow-assistant-position";
type Pos = { x: number; y: number } | null;

const read = (): Pos => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.x === "number" && typeof v.y === "number" ? v : null;
  } catch {
    return null;
  }
};
const write = (p: Pos) => {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered this time.
  }
};

/**
 * Moves the panel with a grip (pointer or arrow keys), kept inside the window and remembered in this browser.
 * null = the default corner. No drag library: a few pointer events do it.
 */
export function useDrag(size: { width: number; height: number }) {
  const [pos, setPos] = useState<Pos>(read);
  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(Math.max(8, x), window.innerWidth - size.width - 8),
      y: Math.min(Math.max(8, y), window.innerHeight - size.height - 8),
    }),
    [size.width, size.height],
  );

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const panel = (
      e.currentTarget.closest("[data-assistant-panel]") as HTMLElement | null
    )?.getBoundingClientRect();
    if (!panel) return;
    const dx = e.clientX - panel.left;
    const dy = e.clientY - panel.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) =>
      setPos(clamp(ev.clientX - dx, ev.clientY - dy));
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const final = clamp(ev.clientX - dx, ev.clientY - dy);
      setPos(final);
      write(final);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudge = (dx: number, dy: number, from: DOMRect) => {
    const next = clamp((pos?.x ?? from.left) + dx, (pos?.y ?? from.top) + dy);
    setPos(next);
    write(next);
  };

  const reset = () => {
    setPos(null);
    write(null);
  };

  return { pos, onPointerDown, nudge, reset };
}
