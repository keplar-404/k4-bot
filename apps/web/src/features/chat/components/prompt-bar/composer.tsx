import { ComposerActions } from "./composer-actions";
import { ComposerSend } from "./composer-send";
import { ComposerTextarea } from "./composer-textarea";
import type { ModeHandlers } from "./mode-state";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";
export function Composer({
  state,
  props,
  h,
}: {
  state: PromptState;
  props: PromptBarProps;
  h: PromptHandlers & PromptHandlers2 & ModeHandlers;
}) {
  return (
    <div
      ref={state.controlsRef}
      className={`grid items-end gap-x-1 gap-y-1.5 ${state.wide ? "grid-cols-[28px_auto_minmax(0,1fr)_28px_28px]" : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"}`}
    >
      <ComposerActions state={state} props={props} h={h} />
      <ComposerTextarea state={state} props={props} h={h} />
      <ComposerSend state={state} props={props} h={h} />
    </div>
  );
}
