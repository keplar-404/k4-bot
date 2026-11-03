import type { FileRef } from "@/features/files/api";
import { FileCard } from "./file-card";

/** Several stored files: a row of previews in a user bubble, a column under an answer. */
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
