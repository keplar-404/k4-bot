"use client";

import { Button } from "@/components/ui/button";

/** The bot changed the open file while the user had unsaved edits: load the bot's version, or keep the user's. */
export function StaleBanner({
  onReload,
  onOverwrite,
}: {
  onReload: () => void;
  onOverwrite: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 bg-amber-500/15 px-3 py-2 text-xs"
    >
      <span className="flex-1">
        The bot changed this file while you were editing.
      </span>
      <Button size="sm" variant="outline" onClick={onReload}>
        Load the bot&apos;s version
      </Button>
      <Button size="sm" variant="ghost" onClick={onOverwrite}>
        Keep mine
      </Button>
    </div>
  );
}
