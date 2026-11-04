"use client";

import { DownloadIcon, FileIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/features/files/download";
import type { WorkspaceFile } from "../../types";
import { TextView } from "./text-view";
import { useFileBlob } from "./use-file-blob";

// Heavy viewers load only when that kind of file is opened.
const DocxView = dynamic(() => import("./docx-view").then((m) => m.DocxView), {
  ssr: false,
});
const XlsxView = dynamic(() => import("./xlsx-view").then((m) => m.XlsxView), {
  ssr: false,
});
const PptxView = dynamic(() => import("./pptx-view").then((m) => m.PptxView), {
  ssr: false,
});

const OOXML = "application/vnd.openxmlformats-officedocument.";
const TEXT = /^(text\/|application\/(json|xml)$)/;

/** One stored file in its own tab: the right viewer for its type, with Download always at hand. */
export function FilePreview({ file }: { file: WorkspaceFile }) {
  const { blob, url, error } = useFileBlob(file);
  const mime = file.mimeType;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {file.name}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void downloadFile(file)}
        >
          <DownloadIcon />
          Download
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : !blob || !url ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : mime.startsWith("image/") ? (
          // biome-ignore lint/performance/noImgElement: a private blob: URL; an <img> never runs an SVG's scripts
          <img src={url} alt={file.name} className="mx-auto max-w-full" />
        ) : mime === "application/pdf" ? (
          <iframe
            src={url}
            title={file.name}
            className="h-full min-h-[70vh] w-full border-0"
          />
        ) : mime === `${OOXML}wordprocessingml.document` ? (
          <DocxView blob={blob} />
        ) : mime === `${OOXML}spreadsheetml.sheet` ? (
          <XlsxView blob={blob} />
        ) : mime === `${OOXML}presentationml.presentation` ? (
          <PptxView blob={blob} />
        ) : TEXT.test(mime) ? (
          <TextView blob={blob} mimeType={mime} name={file.name} />
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground">
            <FileIcon className="size-8" />
            Preview not available for this kind of file.
          </div>
        )}
      </div>
    </div>
  );
}
