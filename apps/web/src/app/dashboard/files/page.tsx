"use client";

import {
  DownloadIcon,
  FolderOpenIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileKindIcon } from "@/components/file-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteFile,
  fileUrl,
  formatBytes,
  isPreviewable,
  type LibraryFile,
  listFiles,
} from "@/lib/files";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upload", label: "Uploaded" },
  { key: "generated", label: "Created by bots" },
  { key: "computer", label: "From the computer" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const ORIGIN: Record<LibraryFile["source"], string> = {
  upload: "Uploaded",
  generated: "Created",
  computer: "Shared from the computer",
};

function FileTile({
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
        <div className="flex shrink-0 gap-1">
          <a
            href={fileUrl(file.id, true)}
            download={file.name}
            aria-label={`Download ${file.name}`}
            title="Download"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <DownloadIcon />
          </a>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${file.name}`}
            title="Delete"
            onClick={() => onDelete(file)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
    </li>
  );
}

/**
 * Every file of the user: what they uploaded, images their bots created, and files bots shared from the computer.
 * All are saved copies, so they download any time, even while the computer sleeps.
 */
export default function FilesPage() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<LibraryFile | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (after: string | null) => {
    try {
      const page = await listFiles(after);
      setFiles((current) => (after ? [...current, ...page.files] : page.files));
      setCursor(page.nextCursor);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void load(null).finally(() => setLoading(false));
  }, [load]);

  const shown =
    filter === "all" ? files : files.filter((f) => f.source === filter);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteFile(deleting.id);
      setFiles((current) => current.filter((f) => f.id !== deleting.id));
      setDeleting(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          What you attached in chats, images your bots created, and files they
          shared from the computer. These are saved copies: they download any
          time, even while the computer is asleep.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Filter files"
        className="flex flex-wrap gap-1"
      >
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            size="sm"
            variant={filter === f.key ? "secondary" : "ghost"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4"
          aria-busy="true"
          aria-label="Loading files"
        >
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <li key={i}>
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <FolderOpenIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">
            {filter === "all" ? "No files yet" : "Nothing here yet"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Attach a file in a chat, ask a bot to create an image, or ask it to
            share a file from the computer.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
          {shown.map((f) => (
            <FileTile key={f.id} file={f} onDelete={setDeleting} />
          ))}
        </ul>
      )}

      {cursor && !loading && (
        <Button
          variant="outline"
          className="self-center"
          disabled={more}
          onClick={() => {
            setMore(true);
            void load(cursor).finally(() => setMore(false));
          }}
        >
          {more && <Loader2Icon className="animate-spin" />}
          Load more
        </Button>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !busy && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from your files and from the chats that show it.
              Copies already on the computer stay there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
