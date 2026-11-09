import { Icon } from "./icons";
import type { ModeHandlers } from "./mode-state";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";

export function ComposerSend({
  state,
  props,
  h,
}: {
  state: PromptState;
  props: PromptBarProps;
  h: PromptHandlers & PromptHandlers2 & ModeHandlers;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={state.listening ? "Stop dictation" : "Start dictation"}
        aria-pressed={state.listening}
        onClick={() => state.setListening((c: boolean) => !c)}
        className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] rounded-[8px] ${state.listening ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink"} ${state.wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1"}`}
      >
        {state.listening ? (
          <span className="flex h-3.5 items-center gap-[2.5px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-[2.5px] rounded-full bg-current"
                style={{
                  height: "100%",
                  animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite`,
                }}
              />
            ))}
          </span>
        ) : (
          <Icon size={15} strokeWidth={2}>
            <g>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
            </g>
          </Icon>
        )}
      </button>
      {props.responding && props.onStop ? (
        <button
          type="button"
          aria-label="Stop"
          title="Stop"
          onClick={props.onStop}
          className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 active:scale-[0.94] rounded-[8px] ${state.wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
          style={{ background: "var(--ink)", color: "var(--surface)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="4" y="4" width="16" height="16" rx="3" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          aria-label="Send"
          disabled={!h.canSend}
          onClick={h.send}
          className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] rounded-[8px] ${state.wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
          style={{
            background: h.canSend ? "var(--ink)" : "var(--line-strong)",
            color: h.canSend ? "var(--surface)" : "var(--ink-2)",
          }}
        >
          <Icon size={16} strokeWidth={2.4}>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </Icon>
        </button>
      )}
    </>
  );
}
