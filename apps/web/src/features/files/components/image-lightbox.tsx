"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { type FileRef, fileUrl } from "@/features/files/api";
import { DownloadButton } from "./download-button";

/** The full image in a popup over the chat, with a Download button. */
export function ImageLightbox({
  file,
  open,
  onOpenChange,
}: {
  file: FileRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-auto max-w-[92vw] flex-col gap-3 sm:max-w-[92vw]">
        <DialogTitle className="truncate pr-8 text-sm">{file.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Full size preview
        </DialogDescription>
        {/* biome-ignore lint/performance/noImgElement: private API image (cookie auth), next/image cannot fetch it */}
        <img
          src={fileUrl(file.id)}
          alt={file.name}
          className="max-h-[75vh] max-w-full rounded-md object-contain"
        />
        <div className="flex justify-end">
          <DownloadButton file={file} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
