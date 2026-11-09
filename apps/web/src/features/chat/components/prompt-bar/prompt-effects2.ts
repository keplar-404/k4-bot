import { useEffect, useLayoutEffect } from "react";
import { startDictation } from "./dictation";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";

export function usePromptEffects2(
  state: PromptState,
  h: PromptHandlers & PromptHandlers2,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useLayoutEffect(() => {
    if (
      !state.effortOpen ||
      !state.composerAnchorRef.current ||
      !state.effortRef.current
    )
      return;
    const anchorRect = state.composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = state.effortRef.current.getBoundingClientRect();
    state.setEffortMenuLeft(
      Math.max(
        0,
        Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 160),
      ),
    );
    state.setEffortMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [state.effortOpen, state.wide, h.model?.name]);
  // shader on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useEffect(() => {
    state.shaderRef.current = h.makeShader();
    return () => {
      state.shaderRef.current?.destroy();
      state.shaderRef.current = null;
    };
  }, []);
  // dictation: the mic button listens once and appends what was said
  // biome-ignore lint/correctness/useExhaustiveDependencies: setters and refs are stable; only the listening flag matters
  useEffect(() => {
    if (!state.listening) return;
    const stop = startDictation(
      (text) =>
        state.setDraft((current: string) =>
          current ? `${current.trimEnd()} ${text}` : text,
        ),
      () => {
        state.setListening(false);
        state.inputRef.current?.focus();
      },
    );
    return () => stop?.();
  }, [state.listening]);
  // auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useLayoutEffect(() => {
    const input = state.inputRef.current;
    const controls = state.controlsRef.current;
    const measure = state.measureRef.current;
    const modelButton = state.modelRef.current;
    if (!input || !controls || !measure || !modelButton) return;
    const fixedControlsWidth = 28 * 3 + modelButton.offsetWidth;
    const inlineGaps = 4 * 4;
    const inlineInputWidth =
      controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth =
      state.draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== state.expanded) state.setExpanded(needsFullWidth);
    const minHeight = 28;
    const maxHeight = 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [state.draft, state.expanded]);
  // close menus on outside click
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useEffect(() => {
    if (!state.modelOpen && !state.plusOpen && !state.effortOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]")) {
        state.setModelOpen(false);
        state.setPlusOpen(false);
        state.setEffortOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [state.modelOpen, state.plusOpen, state.effortOpen]);
}
