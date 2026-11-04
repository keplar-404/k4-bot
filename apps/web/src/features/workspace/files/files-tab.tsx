"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { LibraryFile } from "@/features/files/api/library";
import { DeleteFileDialog } from "@/features/files/components/library/delete-file-dialog";
import { useWorkspace } from "../use-workspace";
import { FileRow } from "./file-row";
import { useBotFiles } from "./use-bot-files";

/** The files this bot has: uploads in its chats, images it created, files it shared from the computer. */
export function FilesTab({ botId }: { botId: string }) {
  const { files, loading, error, hasMore, refresh, loadMore, remove } =
    useBotFiles(botId);
  const { close } = useWorkspace();
  const [deleting, setDeleting] = useState<LibraryFile | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove(deleting.id);
      close(deleting.id);
      toast.success(`Deleted "${deleting.name}"`);
      setDeleting(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">This bot&apos;s files</span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Refresh"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <RefreshCwIcon />
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && files.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No files yet. Files you attach and files the bot creates appear here.
        </p>
      )}
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {files.map((f) => (
          <FileRow key={f.id} file={f} onDelete={setDeleting} />
        ))}
      </ul>
      {hasMore && (
        <Button
          variant="ghost"
          className="m-2"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          Load more
        </Button>
      )}
      <DeleteFileDialog
        file={deleting}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
