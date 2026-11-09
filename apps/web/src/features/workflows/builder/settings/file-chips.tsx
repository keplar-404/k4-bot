"use client";

import { FileIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A file from the Files page in a block's settings (the server uploads it to the app when the block runs). */
export type FileRef = { $file: string; name?: string };

/** The picked files, each with a remove button. */
export function FileChips({
  refs,
  onRemove,
}: {
  refs: FileRef[];
  onRemove: (fileId: string) => void;
}) {
  return refs.map((r) => (
    <div
      key={r.$file}
      className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
    >
      <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{r.name ?? r.$file}</span>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${r.name ?? "file"}`}
        onClick={() => onRemove(r.$file)}
      >
        <XIcon />
      </Button>
    </div>
  ));
}
