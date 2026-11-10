"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import type { LibraryFile } from "../api/library";
import { FilePickerList } from "./file-picker-list";
import { useLibraryFiles } from "./use-library-files";

/** One click on a file: one file replaces the pick, several add up to `max`. */
function toggled(chosen: string[], id: string, max: number) {
  if (chosen.includes(id)) return chosen.filter((x) => x !== id);
  if (max === 1) return [id];
  return chosen.length < max ? [...chosen, id] : chosen;
}

/**
 * Pick files from the user's Files page (uploads, images bots made, files shared from the computer). `max` 1 picks one.
 * Uploading new files stays on the Files page and in chats.
 */
export function FilePickerDialog({
  open,
  onOpenChange,
  max,
  picked,
  onPick,
  title = "Choose files",
  accept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  max: number;
  picked: string[];
  onPick: (files: LibraryFile[]) => void;
  title?: string;
  /** Only files this returns true for can be chosen (e.g. documents a bot can read). */
  accept?: (f: LibraryFile) => boolean;
}) {
  const { files, cursor, loading, error, load } = useLibraryFiles();
  const [{ query, chosen }, , store] = useLocalStore(() => ({
    query: "",
    chosen: picked as string[],
  }));
  const setQuery = fieldSetter(store, "query");
  const setChosen = fieldSetter(store, "chosen");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload on open only
  useEffect(() => {
    if (!open) return;
    setChosen(picked);
    void load(null);
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = files.filter((f) => !q || f.name.toLowerCase().includes(q));
  const toggle = (id: string) => setChosen((c) => toggled(c, id, max));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            From your Files page{max > 1 ? `, up to ${max}` : ""}. Upload new
            files there or in a chat.
          </DialogDescription>
        </DialogHeader>
        <FilePickerList
          query={query}
          onQuery={setQuery}
          files={shown}
          chosen={chosen}
          single={max === 1}
          accept={accept}
          loading={loading}
          error={error}
          onToggle={toggle}
          onMore={cursor && !loading ? () => void load(cursor) : undefined}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onPick(files.filter((f) => chosen.includes(f.id)));
              onOpenChange(false);
            }}
          >
            Use {chosen.length || ""} file{chosen.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
