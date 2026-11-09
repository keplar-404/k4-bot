"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { usePanels } from "./panels-store";
import { useBuilder } from "./store";

/** Typing in a field must never move the canvas or close a panel. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.getAttribute("role") === "combobox");

/** The builder's keyboard shortcuts (listed in shortcuts.ts). Delete is React Flow's own. */
export function useShortcuts() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panels = usePanels.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        panels.toggle("shortcuts");
        return;
      }
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        typing(e.target) ||
        panels.shortcuts
      )
        return;
      const actions: Record<string, () => void> = {
        "[": () => panels.toggle("library"),
        "]": () => panels.toggle("settings"),
        Escape: () => useBuilder.getState().select(null),
        f: () => void fitView({ padding: 0.4, maxZoom: 1, duration: 200 }),
        "+": () => void zoomIn({ duration: 150 }),
        "=": () => void zoomIn({ duration: 150 }),
        "-": () => void zoomOut({ duration: 150 }),
      };
      const run = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitView, zoomIn, zoomOut]);
}

/** Mounted inside the React Flow provider, which the zoom and fit shortcuts need. */
export function ShortcutKeys() {
  useShortcuts();
  return null;
}
