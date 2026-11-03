import { PlusMenuRow } from "./plus-menu-row";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";
export function PlusMenu({
  state,
  h,
  props,
}: {
  state: PromptState;
  h: PromptHandlers & PromptHandlers2;
  props: PromptBarProps;
}) {
  if (!h.menu) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: menu container clears the gliding highlight
    <div
      onMouseLeave={() => state.setEngaged(false)}
      className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] bg-surface p-1 shadow-raised"
      style={{
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "bottom center",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
        style={{
          top: state.rowBox?.top ?? 0,
          height: state.rowBox?.height ?? 0,
          opacity: state.rowBox && state.engaged && h.rows.length > 0 ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {h.rows.map(
        (row: { key: string; name: string; desc: string }, i: number) => (
          <PlusMenuRow
            key={row.key}
            row={row}
            i={i}
            state={state}
            h={h}
            props={props}
          />
        ),
      )}
      {h.rows.length === 0 && (
        <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">
          No matches for “{h.query}”
        </div>
      )}
      <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
        {h.menu === "at"
          ? "Type to search sources & files"
          : "Type to search commands"}
      </div>
    </div>
  );
}
