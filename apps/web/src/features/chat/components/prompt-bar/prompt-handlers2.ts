import { SOURCES } from "./data";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";

export function usePromptHandlers2(
  state: PromptState,
  props: PromptBarProps,
  h: PromptHandlers,
) {
  const closeMenus = () => {
    state.setPlusOpen(false);
    state.setModelOpen(false);
    state.setEffortOpen(false);
  };
  const pick = (row: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === row.key);
    if (source?.attach) {
      state.fileInputRef.current?.click();
      if (h.token) state.setDraft(state.draft.slice(0, h.token.start));
    } else if (h.menu === "at") {
      state.setDraft(
        `${h.token ? state.draft.slice(0, h.token.start) : state.draft}@${row.name} `,
      );
    } else {
      state.setDraft(
        `${h.token ? state.draft.slice(0, h.token.start) : state.draft}${row.name} `,
      );
    }
    state.setPlusOpen(false);
    state.setDismissed(false);
    state.inputRef.current?.focus();
  };
  const send = () => {
    if (!h.canSend) return;
    props.onSend?.(state.draft.trim());
    state.setDraft("");
    closeMenus();
  };
  const takeFiles = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []);
    if (files.length && props.onAttach) props.onAttach(files);
    return files.length > 0;
  };
  return { closeMenus, pick, send, takeFiles };
}

export type PromptHandlers2 = ReturnType<typeof usePromptHandlers2>;
