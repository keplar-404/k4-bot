import { useEffect, useLayoutEffect } from "react";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";

export function usePromptEffects(
  state: PromptState,
  h: PromptHandlers & PromptHandlers2,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useEffect(() => {
    state.setActive(0);
    state.setEngaged(false);
  }, [h.menu, h.query]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useLayoutEffect(() => {
    const target = state.rowRefs.current[state.active];
    if (target)
      state.setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [h.menu, h.query, state.active, state.connected, h.rows.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useLayoutEffect(() => {
    if (!state.modelOpen) return;
    const target =
      state.modelRowRefs.current[state.modelHovered ?? h.modelIndex];
    if (target)
      state.setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [state.modelOpen, state.modelHovered, h.modelIndex]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useLayoutEffect(() => {
    if (
      !state.modelOpen ||
      !state.composerAnchorRef.current ||
      !state.modelRef.current
    )
      return;
    const anchorRect = state.composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = state.modelRef.current.getBoundingClientRect();
    state.setModelMenuLeft(
      Math.max(
        0,
        Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 256),
      ),
    );
    state.setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [state.modelOpen, state.wide, h.model?.name]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useEffect(() => {
    if (!state.modelOpen) state.setModelHovered(null);
  }, [state.modelOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useLayoutEffect(() => {
    if (!state.effortOpen) return;
    const target =
      state.effortRowRefs.current[
        state.effortHovered ?? Math.max(0, h.effortIndex)
      ];
    if (target)
      state.setEffortBox({
        top: target.offsetTop,
        height: target.offsetHeight,
      });
  }, [state.effortOpen, state.effortHovered, h.effortIndex, h.efforts.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect copied from original prompt-bar; dependency list preserved intentionally
  useEffect(() => {
    if (!state.effortOpen) state.setEffortHovered(null);
  }, [state.effortOpen]);
}
