import { FolderOpenIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibraryFile } from "@/features/files/api";
import { FileTile } from "./file-tile";

/** The files as a grid, or placeholders while loading, or what to do when there are none. */
export function LibraryGrid({
  loading,
  shown,
  filtered,
  onDelete,
}: {
  loading: boolean;
  shown: LibraryFile[];
  filtered: boolean;
  onDelete: (file: LibraryFile) => void;
}) {
  return loading ? (
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
        {filtered ? "Nothing here yet" : "No files yet"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Attach a file in a chat, ask a bot to create an image, or ask it to
        share a file from the computer.
      </p>
    </div>
  ) : (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
      {shown.map((f) => (
        <FileTile key={f.id} file={f} onDelete={onDelete} />
      ))}
    </ul>
  );
}
