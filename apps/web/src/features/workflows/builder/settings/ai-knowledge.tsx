"use client";

import { FileTextIcon, XIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { type LibraryFile, listFiles } from "@/features/files/api/library";
import { FilePickerDialog } from "@/features/files/components/file-picker-dialog";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** Documents a bot can read (the same kinds read_document reads). */
const READABLE =
  /^(application\/pdf|text\/|application\/(json|xml)|application\/vnd\.(openxmlformats|oasis|ms-))/;

/**
 * Knowledge files for an AI step (price lists, policies, FAQs): the bot reads the ones that help before it answers.
 * Only these files, and only the user's own.
 */
export function AiKnowledge({
  files,
  onChange,
}: {
  files: string[];
  onChange: (ids: string[]) => void;
}) {
  const [{ picking, names }, , store] = useLocalStore(() => ({
    picking: false,
    names: {} as Record<string, string>,
  }));
  const setPicking = fieldSetter(store, "picking");
  const setNames = fieldSetter(store, "names");
  // Names for files picked earlier (the block stores only ids): the first page of the library is enough for most.
  useEffect(() => {
    if (files.length === 0 || files.every((id) => names[id])) return;
    listFiles().then(
      (page) =>
        setNames((n) => ({
          ...n,
          ...Object.fromEntries(page.files.map((f) => [f.id, f.name])),
        })),
      () => undefined,
    );
  }, [files, names, setNames]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs">Knowledge files</span>
      {files.map((id) => (
        <div
          key={id}
          className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
        >
          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{names[id] ?? "File"}</span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Remove file"
            onClick={() => onChange(files.filter((f) => f !== id))}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        size="xs"
        variant="outline"
        className="self-start"
        onClick={() => setPicking(true)}
      >
        {files.length ? "Change files" : "Add files"}
      </Button>
      <span className="text-muted-foreground text-xs">
        PDFs, documents and text it may read for this task (up to 10), such as
        your prices or policies.
      </span>
      <FilePickerDialog
        open={picking}
        onOpenChange={setPicking}
        max={10}
        picked={files}
        title="Knowledge files"
        accept={(f: LibraryFile) => READABLE.test(f.mimeType)}
        onPick={(picked) => {
          setNames((n) => ({
            ...n,
            ...Object.fromEntries(picked.map((f) => [f.id, f.name])),
          }));
          onChange(picked.map((f) => f.id));
        }}
      />
    </div>
  );
}
