"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DeleteFileDialog } from "@/features/files/components/library/delete-file-dialog";
import {
  type Filter,
  FilterTabs,
} from "@/features/files/components/library/filter-tabs";
import { LibraryGrid } from "@/features/files/components/library/library-grid";
import { useFileLibrary } from "@/features/files/hooks/use-file-library";

/**
 * Every file of the user: what they uploaded, images their bots created, and files bots shared from the computer.
 * All are saved copies, so they download any time, even while the computer sleeps.
 */
export default function FilesPage() {
  const {
    files,
    cursor,
    loading,
    more,
    loadMore,
    deleting,
    setDeleting,
    busy,
    confirmDelete,
  } = useFileLibrary();
  const [filter, setFilter] = useState<Filter>("all");
  const shown =
    filter === "all" ? files : files.filter((f) => f.source === filter);

  return (
    <>
      <PageHeader title="Files" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Files</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            What you attached in chats, images your bots created, and files they
            shared from the computer. These are saved copies: they download any
            time, even while the computer is asleep.
          </p>
        </header>

        <FilterTabs filter={filter} onChange={setFilter} />

        <LibraryGrid
          loading={loading}
          shown={shown}
          filtered={filter !== "all"}
          onDelete={setDeleting}
        />

        {cursor && !loading && (
          <Button
            variant="outline"
            className="self-center"
            disabled={more}
            onClick={loadMore}
          >
            {more && <Loader2Icon className="animate-spin" />}
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
    </>
  );
}
