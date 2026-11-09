import type { FileRef } from "@/features/files/api";
import { FileCard } from "./file-card";

/**
 * Several stored files: a row of previews in a user bubble (`compact`), and a grid of cards under an answer
 * (one column on phones, two on tablets, three on wide screens).
 */
export function FileList({
  files,
  compact,
}: {
  files: FileRef[];
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-wrap justify-end gap-2"
          : "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {files.map((f) => (
        <FileCard key={f.id} file={f} compact={compact} />
      ))}
    </div>
  );
}
