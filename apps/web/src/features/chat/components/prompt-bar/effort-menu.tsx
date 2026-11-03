import { Icon } from "./icons";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
export function EffortMenu({
  state,
  h,
}: {
  state: PromptState;
  h: PromptHandlers & PromptHandlers2;
}) {
  if (!state.effortOpen || h.efforts.length === 0) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: menu container clears the gliding highlight
    <div
      onMouseLeave={() => state.setEffortHovered(null)}
      className="absolute z-10 w-40 rounded-[10px] bg-surface p-1 shadow-raised"
      style={{
        left: state.effortMenuLeft,
        bottom: state.effortMenuBottom,
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "bottom left",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
        style={{
          top: state.effortBox?.top ?? 0,
          height: state.effortBox?.height ?? 0,
          opacity: state.effortBox && state.effortHovered !== null ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {h.efforts.map((level: string, i: number) => (
        <button
          key={level}
          type="button"
          ref={(el) => {
            state.effortRowRefs.current[i] = el;
          }}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => state.setEffortHovered(i)}
          onClick={() => {
            state.setEffortOpen(false);
            if (h.model) h.onSelect?.(h.model.key, level);
            state.inputRef.current?.focus();
          }}
          className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
            {level}
          </span>
          <span
            className={`shrink-0 text-ink ${level === h.effort ? "" : "invisible"}`}
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
