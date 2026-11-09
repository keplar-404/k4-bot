import { AttachmentChips } from "./attachment-chips";
import type { PromptHandlers } from "./prompt-handlers";
import type { PromptHandlers2 } from "./prompt-handlers2";
import type { PromptState } from "./prompt-state";
import type { PromptBarProps } from "./types";
export function ComposerCanvas({
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
      {state.dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-surface/85 text-[12.5px] text-ink-2">
          Drop files to attach
        </div>
      )}
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative canvas, not keyboard-reachable (verbatim demo code) */}
      <canvas
        ref={state.glimmRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        style={{ borderRadius: "inherit" }}
      />
      <span
        ref={state.measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
      >
        {state.draft}
      </span>
      <AttachmentChips state={state} props={props} />
    </>
  );
}
