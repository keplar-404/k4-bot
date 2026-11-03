import { Icon } from "./icons";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";
export function ComposerActions({
  state,
  props,
  h,
}: {
  state: PromptState;
  props: PromptBarProps;
  h: PromptHandlers & PromptHandlers2;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Add attachments and sources"
        aria-expanded={state.plusOpen}
        onClick={() => {
          state.setModelOpen(false);
          state.setPlusOpen((c: boolean) => !c);
          state.inputRef.current?.focus();
        }}
        className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94] rounded-[8px] ${state.plusOpen ? "bg-hover text-ink" : ""} ${state.wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
      >
        <Icon size={16} strokeWidth={2}>
          <path d="M12 5v14M5 12h14" />
        </Icon>
      </button>
      <div
        className={`flex items-center gap-0.5 ${state.wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1"}`}
      >
        {h.efforts.length > 0 && (
          <button
            ref={state.effortRef}
            type="button"
            aria-expanded={state.effortOpen}
            aria-label="Reasoning effort"
            onClick={() => {
              state.setPlusOpen(false);
              state.setModelOpen(false);
              state.setEffortOpen((c: boolean) => !c);
            }}
            className={`flex h-7 shrink-0 items-center px-1.5 text-[11px] font-medium uppercase tracking-wide transition-colors duration-150 rounded-[8px] ${state.effortOpen ? "bg-hover text-ink" : "text-ink-3 hover:bg-hover hover:text-ink"}`}
          >
            {h.effort ?? "effort"}
          </button>
        )}
        <button
          ref={state.modelRef}
          type="button"
          aria-expanded={state.modelOpen}
          aria-label="Choose model"
          disabled={h.catalog.length === 0}
          onClick={() => {
            state.setPlusOpen(false);
            state.setEffortOpen(false);
            state.setModelOpen((c: boolean) => !c);
          }}
          className="flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink rounded-[8px]"
        >
          {h.model?.name ?? "Loading…"}
          <span className="text-ink-3">
            <Icon size={11} strokeWidth={2.4}>
              <path d="M6 9l6 6 6-6" />
            </Icon>
          </span>
        </button>
      </div>
    </>
  );
}
