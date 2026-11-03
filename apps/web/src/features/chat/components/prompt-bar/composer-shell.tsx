import { Composer } from "./composer";
import { ComposerCanvas } from "./composer-canvas";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";
export function ComposerShell({
  state,
  props,
  h,
}: {
  state: PromptState;
  props: PromptBarProps;
  h: PromptHandlers & PromptHandlers2;
}) {
  return (
    <div
      className={`relative isolate flex flex-col gap-1.5 overflow-hidden rounded-[14px] border bg-surface p-1.5 shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${state.dragging ? "border-dashed border-line-strong" : "border-line"}`}
    >
      <ComposerCanvas state={state} props={props} h={h} />
      <Composer state={state} props={props} h={h} />
    </div>
  );
}
