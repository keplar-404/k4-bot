"use client";

import {
  DownloadIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  ImageOffIcon,
  Maximize2Icon,
} from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { type FileRef, fileUrl, formatBytes, isPreviewable } from "@/lib/files";

/** An icon that says what kind of file it is, from its type and extension. */
export function FileKindIcon({
  file,
  className,
}: {
  file: Pick<FileRef, "name" | "mimeType">;
  className?: string;
}) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const t = file.mimeType;
  const Icon = t.startsWith("image/")
    ? FileImageIcon
    : t.startsWith("video/")
      ? FileVideoIcon
      : t.startsWith("audio/")
        ? FileAudioIcon
        : ["zip", "gz", "tar", "tgz", "7z", "rar"].includes(ext)
          ? FileArchiveIcon
          : ["csv", "xls", "xlsx"].includes(ext)
            ? FileSpreadsheetIcon
            : ["js", "ts", "py", "json", "html", "css", "sh"].includes(ext)
              ? FileCodeIcon
              : t.startsWith("text/") ||
                  ["pdf", "doc", "docx", "md"].includes(ext)
                ? FileTextIcon
                : FileIcon;
  return <Icon className={className} />;
}

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
  const download = (
    <a
      href={fileUrl(file.id, true)}
      download={file.name}
      aria-label={`Download ${file.name}`}
      title="Download"
      className={buttonVariants({ variant: "outline", size: "icon-sm" })}
    >
      <DownloadIcon />
    </a>
  );

  if (isPreviewable(file.mimeType) && !broken) {
    return (
      <figure
        className={`group/file relative overflow-hidden rounded-xl border bg-muted/40 ${compact ? "w-40" : "w-full max-w-sm"}`}
      >
        <a
          href={fileUrl(file.id)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${file.name} full size`}
          className="block"
        >
          {/* biome-ignore lint/performance/noImgElement: private API image (cookie auth), next/image cannot fetch it */}
          <img
            src={fileUrl(file.id)}
            alt={file.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className={`w-full object-cover ${compact ? "aspect-square" : "max-h-96"}`}
          />
        </a>
        {/* Visible on hover and keyboard focus; always visible on touch screens (no hover). */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/file:opacity-100 [@media(hover:hover)]:group-hover/file:opacity-100">
          <a
            href={fileUrl(file.id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${file.name} full size`}
            title="Open full size"
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <Maximize2Icon />
          </a>
          {download}
        </div>
        {!compact && (
          <figcaption className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="truncate">{file.name}</span>
            <span className="shrink-0">{formatBytes(file.size)}</span>
          </figcaption>
        )}
      </figure>
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
      {!broken && <ItemActions>{download}</ItemActions>}
    </Item>
  );
}

export function FileList({
  files,
  compact,
}: {
  files: FileRef[];
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap gap-2 ${compact ? "justify-end" : "flex-col"}`}
    >
      {files.map((f) => (
        <FileCard key={f.id} file={f} compact={compact} />
      ))}
    </div>
  );
}
