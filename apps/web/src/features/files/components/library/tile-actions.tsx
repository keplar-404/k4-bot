import { DownloadIcon, Trash2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { fileUrl, type LibraryFile } from "@/features/files/api";

/** Download and Delete for one file tile. */
export function TileActions({
  file,
  onDelete,
}: {
  file: LibraryFile;
  onDelete: (file: LibraryFile) => void;
}) {
  return (
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
  );
}
