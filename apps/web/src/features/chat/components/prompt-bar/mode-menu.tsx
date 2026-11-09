import { Icon } from "./icons";
import type { ModeHandlers } from "./mode-state";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
export function ModeMenu({
  state,
  modeState,
  h,
}: {
  state: PromptState;
  modeState: ModeHandlers;
  h: PromptHandlers & PromptHandlers2;
}) {
  if (!modeState.modeOpen) return null;
  const modes = ["allow_all", "plan", "ask"] as const;
  const labels = { allow_all: "Allow all", plan: "Plan", ask: "Ask" } as const;
  const descs = {
    allow_all:
      "Acts without asking (but still asks before turning on the computer or deleting a sandbox)",
    plan: "Plans first, acts after you approve the plan",
    ask: "Asks before changing anything",
  } as const;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: menu container clears the gliding highlight
    <div
      onMouseLeave={() => modeState.setModeHovered(null)}
      className="absolute z-10 w-64 rounded-[10px] bg-surface p-1 shadow-raised"
      style={{
        left: modeState.modeMenuLeft,
        bottom: modeState.modeMenuBottom,
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "bottom left",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
        style={{
          top: modeState.modeBox?.top ?? 0,
          height: modeState.modeBox?.height ?? 0,
          opacity: modeState.modeBox && modeState.modeHovered !== null ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {modes.map((m, i) => (
        <button
          key={m}
          type="button"
          ref={(el) => {
            modeState.modeRowRefs.current[i] = el;
          }}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => modeState.setModeHovered(i)}
          onClick={() => {
            modeState.setModeOpen(false);
            modeState.onModeChange?.(m);
            state.inputRef.current?.focus();
          }}
          className="relative z-10 flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left whitespace-normal"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-ink">
              {labels[m]}
            </span>
            <span className="block text-[11px] leading-snug text-ink-3 break-words">
              {descs[m]}
            </span>
          </span>
          <span
            className={`mt-0.5 shrink-0 text-ink ${m === modeState.mode ? "" : "invisible"}`}
          >
            <Icon size={13} strokeWidth={2.5}>
              <path d="M20 6L9 17l-5-5" />
            </Icon>
          </span>
        </button>
      ))}
    </div>
  );
}
