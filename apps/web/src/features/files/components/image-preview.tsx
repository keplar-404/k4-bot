"use client";

import { Maximize2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type FileRef, fileUrl, formatBytes } from "@/features/files/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { DownloadButton } from "./download-button";
import { ImageLightbox } from "./image-lightbox";

/** White icons on the dark gradient: readable on any image. */
const OVERLAY_BUTTON = "text-white hover:bg-white/20 hover:text-white";

/** A stored image: click it (or the expand button) for the full image in a popup; Download saves it. */
export function ImagePreview({
  file,
  compact,
  onBroken,
}: {
  file: FileRef;
  compact: boolean;
  onBroken: () => void;
}) {
  const [{ open }, , store] = useLocalStore(() => ({
    open: false,
  }));
  const setOpen = fieldSetter(store, "open");
  return (
    <figure
      className={`group/file relative overflow-hidden rounded-xl border bg-muted/40 ${compact ? "w-40" : "w-full max-w-sm"}`}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${file.name} full size`}
        className="block w-full cursor-zoom-in"
      >
        {/* biome-ignore lint/performance/noImgElement: private API image (cookie auth), next/image cannot fetch it */}
        <img
          src={fileUrl(file.id)}
          alt={file.name}
          loading="lazy"
          onError={onBroken}
          className={`w-full object-cover ${compact ? "aspect-square" : "max-h-96"}`}
        />
      </button>
      {/* Visible on hover and keyboard focus; always visible on touch screens (no hover). */}
      <div className="absolute inset-x-0 top-0 flex justify-end gap-1 bg-gradient-to-b from-black/60 to-transparent p-2 pb-6 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/file:opacity-100 [@media(hover:hover)]:group-hover/file:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={OVERLAY_BUTTON}
          aria-label={`Open ${file.name} full size`}
          title="Open full size"
          onClick={() => setOpen(true)}
        >
          <Maximize2Icon />
        </Button>
        <DownloadButton
          file={file}
          variant="ghost"
          className={OVERLAY_BUTTON}
        />
      </div>
      {!compact && (
        <figcaption className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">{file.name}</span>
          <span className="shrink-0">{formatBytes(file.size)}</span>
        </figcaption>
      )}
      <ImageLightbox file={file} open={open} onOpenChange={setOpen} />
    </figure>
  );
}
