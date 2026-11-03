import { Icon } from "./icons";
import type { PromptState } from "./prompt-state";
import type { ComposerAttachment, PromptBarProps } from "./types";
export function AttachmentChips({
  state,
  props,
}: {
  state: PromptState;
  props: PromptBarProps;
}) {
  if (!props.attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-0.5 pt-0.5">
      {(props.attachments as ComposerAttachment[]).map((file) => (
        <span
          key={file.key}
          className="relative flex h-6.5 items-center gap-1.5 overflow-hidden rounded-chip bg-field py-1 pr-1 pl-1.5 text-[11.5px] text-ink-2 shadow-hairline"
          style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
          title={
            file.progress < 1
              ? `Uploading ${Math.round(file.progress * 100)}%`
              : file.name
          }
        >
          {file.preview ? (
            // biome-ignore lint/performance/noImgElement: local object URL preview
            <img
              src={file.preview}
              alt=""
              className="size-4 rounded-[3px] object-cover"
            />
          ) : (
            <Icon size={12}>
              <g>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </g>
            </Icon>
          )}
          <span
            className={`max-w-36 truncate ${file.progress < 1 ? "opacity-60" : ""}`}
          >
            {file.name}
          </span>
          {file.progress < 1 && (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-0.5 bg-ink-3 transition-[width] duration-200"
              style={{ width: `${Math.max(4, file.progress * 100)}%` }}
            />
          )}
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => props.onRemoveAttachment?.(file.key)}
            className="-my-1 flex size-6 items-center justify-center rounded-[5px] text-ink-3 transition-colors duration-100 hover:bg-line/70 hover:text-ink"
          >
            <Icon size={10} strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </Icon>
          </button>
        </span>
      ))}
    </div>
  );
}
