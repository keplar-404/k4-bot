"use client";

import { DownloadIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBytes, type LibraryFile } from "@/features/files/api/library";
import { FileKindIcon } from "@/features/files/components/file-kind-icon";
import { downloadFile } from "@/features/files/download";
import { useWorkspace } from "../use-workspace";

/** One file: click to open it in its own tab; Download; Delete (asks first, in the Files tab). */
export function FileRow({
  file,
  onDelete,
}: {
  file: LibraryFile;
  onDelete: (file: LibraryFile) => void;
}) {
  const { open } = useWorkspace();
  const download = () =>
    void downloadFile(file).catch((e: Error) => toast.error(e.message));
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => open(file)}
      >
        <FileKindIcon file={file} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {file.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatBytes(file.size)} ·{" "}
            {new Date(file.createdAt).toLocaleDateString()}
          </span>
        </span>
      </button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Download ${file.name}`}
        onClick={download}
      >
        <DownloadIcon />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Delete ${file.name}`}
        onClick={() => onDelete(file)}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
