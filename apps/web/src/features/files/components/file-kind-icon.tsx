import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import type { FileRef } from "@/features/files/api";

/** An icon that says what kind of file it is, from its type and extension. */
export function FileKindIcon({
  file,
  className,
}: {
  file: Pick<FileRef, "name" | "mimeType">;
  className?: string;
}) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const t = file.mimeType;
  const Icon = t.startsWith("image/")
    ? FileImageIcon
    : t.startsWith("video/")
      ? FileVideoIcon
      : t.startsWith("audio/")
        ? FileAudioIcon
        : ["zip", "gz", "tar", "tgz", "7z", "rar"].includes(ext)
          ? FileArchiveIcon
          : ["csv", "xls", "xlsx"].includes(ext)
            ? FileSpreadsheetIcon
            : ["js", "ts", "py", "json", "html", "css", "sh"].includes(ext)
              ? FileCodeIcon
              : t.startsWith("text/") ||
                  ["pdf", "doc", "docx", "md"].includes(ext)
                ? FileTextIcon
                : FileIcon;
  return <Icon className={className} />;
}
