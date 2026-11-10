"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FileRef } from "@/features/files/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { downloadFile } from "../download";

/** Saves the file to the device (no navigation away from the chat). */
export function DownloadButton({
  file,
  variant = "outline",
  className,
}: {
  file: Pick<FileRef, "id" | "name">;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      size="icon-sm"
      disabled={busy}
      aria-label={`Download ${file.name}`}
      title="Download"
      onClick={async () => {
        setBusy(true);
        try {
          await downloadFile(file);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
    </Button>
  );
}
