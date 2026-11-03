import { Icon } from "./icons";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { ModelOption } from "./types";
export function ModelMenu({
  state,
  h,
}: {
  state: PromptState;
  h: PromptHandlers & PromptHandlers2;
}) {
  if (!state.modelOpen) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: menu container clears the gliding highlight
    <div
      onMouseLeave={() => state.setModelHovered(null)}
      className="absolute z-10 w-64 rounded-[10px] bg-surface p-1 shadow-raised"
      style={{
        left: state.modelMenuLeft,
        bottom: state.modelMenuBottom,
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "bottom left",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
        style={{
          top: state.modelBox?.top ?? 0,
          height: state.modelBox?.height ?? 0,
          opacity: state.modelBox && state.modelHovered !== null ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {h.catalog.map((m: ModelOption, i: number) => (
        <button
          key={m.key}
          type="button"
          ref={(el) => {
            state.modelRowRefs.current[i] = el;
          }}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => state.setModelHovered(i)}
          onClick={() => {
            h.selectModel(m);
            state.inputRef.current?.focus();
          }}
          className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
            {m.name}
          </span>
          <span className="shrink-0 text-[11px] text-ink-3">{m.tag ?? ""}</span>
          <span
            className={`shrink-0 text-ink ${m.key === h.model?.key ? "" : "invisible"}`}
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
