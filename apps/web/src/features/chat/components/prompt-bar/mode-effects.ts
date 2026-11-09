import { useEffect, useLayoutEffect } from "react";
import type { ModeHandlers } from "./mode-state";
import type { PromptState } from "./prompt-state";

const MENU_WIDTH = 256;

/** Position, hover highlight and outside-click close for the mode menu (the effort menu's pattern). */
export function useModeEffects(state: PromptState, m: ModeHandlers) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable; only the open flag and layout matter
  useLayoutEffect(() => {
    const anchor = state.composerAnchorRef.current;
    const trigger = m.modeRef.current;
    if (!m.modeOpen || !anchor || !trigger) return;
    const a = anchor.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    m.setModeMenuLeft(
      Math.max(0, Math.min(t.left - a.left, a.width - MENU_WIDTH)),
    );
    m.setModeMenuBottom(a.bottom - t.top + 8);
  }, [m.modeOpen, state.wide]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable
  useLayoutEffect(() => {
    if (!m.modeOpen) return;
    const modes = ["allow_all", "plan", "ask"];
    const target =
      m.modeRowRefs.current[m.modeHovered ?? modes.indexOf(m.mode ?? "ask")];
    if (target)
      m.setModeBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [m.modeOpen, m.modeHovered, m.mode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable
  useEffect(() => {
    if (!m.modeOpen) m.setModeHovered(null);
  }, [m.modeOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable
  useEffect(() => {
    if (!m.modeOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]"))
        m.setModeOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [m.modeOpen]);
}
