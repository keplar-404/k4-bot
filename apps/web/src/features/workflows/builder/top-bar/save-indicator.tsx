import { CircleAlertIcon, CloudCheckIcon, Loader2Icon } from "lucide-react";
import type { SaveState } from "../use-autosave";

/** Saved / Saving… / Unsaved / the reason a save failed. Announced politely to screen readers. */
export function SaveIndicator({
  state,
  message,
}: {
  state: SaveState;
  message: string | null;
}) {
  const content = {
    saved: {
      icon: <CloudCheckIcon className="size-3.5" />,
      text: "Saved",
      tone: "text-muted-foreground",
    },
    unsaved: {
      icon: null,
      text: "Unsaved changes",
      tone: "text-muted-foreground",
    },
    saving: {
      icon: <Loader2Icon className="size-3.5 animate-spin" />,
      text: "Saving…",
      tone: "text-muted-foreground",
    },
    error: {
      icon: <CircleAlertIcon className="size-3.5" />,
      text: message ?? "Not saved",
      tone: "text-destructive",
    },
    conflict: {
      icon: <CircleAlertIcon className="size-3.5" />,
      text: "Changed in another tab. Reload to continue.",
      tone: "text-destructive",
    },
  }[state];
  return (
    <output
      aria-live="polite"
      className={`hidden max-w-72 items-center gap-1.5 truncate text-xs sm:flex ${content.tone}`}
    >
      {content.icon}
      {content.text}
    </output>
  );
}
