import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";
export function ComposerTextarea({
  state,
  props,
  h,
}: {
  state: PromptState;
  props: PromptBarProps;
  h: PromptHandlers & PromptHandlers2;
}) {
  return (
    <textarea
      ref={state.inputRef}
      rows={1}
      value={state.draft}
      onChange={(event) => {
        state.setDraft(event.target.value);
        state.setDismissed(false);
        state.setPlusOpen(false);
      }}
      onPaste={(event) => {
        if (props.onAttach && h.takeFiles(event.clipboardData.files))
          event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (h.menu && h.rows.length > 0) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            state.setEngaged(true);
            state.setActive(
              (current: number) =>
                (current +
                  (event.key === "ArrowDown" ? 1 : h.rows.length - 1)) %
                h.rows.length,
            );
            return;
          }
          if (
            (event.key === "Enter" && !event.shiftKey) ||
            event.key === "Tab"
          ) {
            event.preventDefault();
            h.pick(h.rows[state.active]);
            return;
          }
        }
        if (event.key === "Escape") {
          state.setDismissed(true);
          h.closeMenus();
          return;
        }
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          h.send();
        }
      }}
      placeholder={
        state.listening
          ? "Listening…"
          : (props.placeholder ?? "Write a message…")
      }
      aria-label="Prompt"
      className={`min-h-7 px-1 py-[5px] text-[13px] leading-[18px] min-w-0 w-full resize-none bg-transparent text-ink outline-none [overflow-wrap:anywhere] placeholder:text-ink-3 ${state.wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"}`}
    />
  );
}
