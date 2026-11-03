import { BRANDS } from "./brands";
import { SOURCES } from "./data";
import { GLYPHS, Icon } from "./icons";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";

export function PlusMenuRow({
  row,
  i,
  state,
  h,
  props,
}: {
  row: { key: string; name: string; desc: string };
  i: number;
  state: PromptState;
  h: PromptHandlers & PromptHandlers2;
  props: PromptBarProps;
}) {
  const source =
    h.menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
  return (
    <button
      key={row.key}
      type="button"
      ref={(el) => {
        state.rowRefs.current[i] = el;
      }}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => {
        state.setActive(i);
        state.setEngaged(true);
      }}
      onClick={() => h.pick(row)}
      className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
    >
      {source && (
        <span className="flex size-5.5 shrink-0 items-center justify-center text-ink-2">
          {source.brand ? (
            BRANDS[source.brand]
          ) : (
            <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>
          )}
        </span>
      )}
      <span className="shrink-0 text-[12.5px] font-medium text-ink">
        {row.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">
        {row.desc}
      </span>
      {source?.connect && (
        // biome-ignore lint/a11y/useSemanticElements: verbatim demo code
        // biome-ignore lint/a11y/useKeyWithClickEvents: verbatim demo code
        <span
          role="button"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            state.setConnected((c: boolean) => !c);
          }}
          className={`shrink-0 text-[12px] font-medium transition-colors duration-100 ${state.connected ? "text-green" : "text-accent-ink hover:underline"}`}
        >
          {state.connected ? "Connected" : "Connect"}
        </span>
      )}
    </button>
  );
}
