"use client";

import { useState } from "react";
import {
  fileUrl,
  formatBytes,
  isPreviewable,
  type LibraryFile,
} from "@/features/files/api";
import { FileKindIcon } from "@/features/files/components/file-kind-icon";
import { TileActions } from "./tile-actions";

const ORIGIN: Record<LibraryFile["source"], string> = {
  upload: "Uploaded",
  generated: "Created",
  computer: "Shared from the computer",
};

/** One file on the Files page: a preview or icon, its name, size, date and origin, Download and Delete. */
export function FileTile({
  file,
  onDelete,
}: {
  file: LibraryFile;
  onDelete: (file: LibraryFile) => void;
}) {
  const [broken, setBroken] = useState(false);
  const date = new Date(file.createdAt).toLocaleDateString([], {
    dateStyle: "medium",
  });
  return (
    <li className="group/tile flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
      <a
        href={fileUrl(file.id, !isPreviewable(file.mimeType))}
        target={isPreviewable(file.mimeType) ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="flex aspect-[4/3] items-center justify-center bg-muted/50 text-muted-foreground"
        aria-label={
          isPreviewable(file.mimeType)
            ? `Open ${file.name}`
            : `Download ${file.name}`
        }
      >
        {isPreviewable(file.mimeType) && !broken ? (
          // biome-ignore lint/performance/noImgElement: private API image (cookie auth), next/image cannot fetch it
          <img
            src={fileUrl(file.id)}
            alt={file.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : (
          <FileKindIcon file={file} className="size-10 stroke-[1.25]" />
        )}
      </a>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatBytes(file.size)} · {date}
          </p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={file.computerPath ?? file.prompt ?? undefined}
          >
            {ORIGIN[file.source]}
            {file.botName
              ? ` · ${file.botName}`
              : file.botId === null && file.source !== "upload"
                ? " · deleted bot"
                : ""}
          </p>
        </div>
        <TileActions file={file} onDelete={onDelete} />
      </div>
    </li>
  );
}
