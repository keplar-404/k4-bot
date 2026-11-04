"use client";

import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { type FileRef, formatBytes, isPreviewable } from "@/features/files/api";
import { useOptionalWorkspace } from "@/features/workspace/use-workspace";
import { DownloadButton } from "./download-button";
import { FileKindIcon } from "./file-kind-icon";
import { ImagePreview } from "./image-preview";

const SOURCE_LABEL: Record<FileRef["source"], string> = {
  upload: "Uploaded",
  generated: "Created",
  computer: "From the computer",
};

/**
 * A stored file in the chat. Images show a preview (click to open it full size); other files are a row with
 * a Download button. Links go to the API, which serves the saved copy: they work while the computer sleeps.
 */
export function FileCard({
  file,
  compact = false,
}: {
  file: FileRef;
  /** Inside the user's bubble: a smaller preview. */
  compact?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  // On the bot page a file also opens in the side bar; elsewhere (the Files page) there is no workspace.
  const ws = useOptionalWorkspace();
  if (isPreviewable(file.mimeType) && !broken) {
    return (
      <ImagePreview
        file={file}
        compact={compact}
        onBroken={() => setBroken(true)}
      />
    );
  }

  return (
    <Item
      variant="outline"
      size="sm"
      className={compact ? "w-56 bg-background/60" : "w-full max-w-sm"}
    >
      <ItemMedia variant="icon">
        {broken ? <ImageOffIcon /> : <FileKindIcon file={file} />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="block w-full truncate">{file.name}</ItemTitle>
        <ItemDescription>
          {broken
            ? "This file is no longer available"
            : `${formatBytes(file.size)} · ${SOURCE_LABEL[file.source] ?? "File"}`}
        </ItemDescription>
      </ItemContent>
      {!broken && (
        <ItemActions>
          {ws && (
            <Button size="sm" variant="ghost" onClick={() => ws.open(file)}>
              Open
            </Button>
          )}
          <DownloadButton file={file} />
        </ItemActions>
      )}
    </Item>
  );
}
