"use client";

import { FileIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatBytes, type LibraryFile } from "../api/library";

/** The picker's rows: a radio (one file) or checkbox (several) per file; files `accept` refuses are greyed out. */
export function FilePickerList({
  query,
  onQuery,
  files,
  chosen,
  single,
  accept,
  loading,
  error,
  onToggle,
  onMore,
}: {
  query: string;
  onQuery: (q: string) => void;
  files: LibraryFile[];
  chosen: string[];
  single: boolean;
  accept?: (f: LibraryFile) => boolean;
  loading: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  /** Present while there are more files to load. */
  onMore?: () => void;
}) {
  return (
    <>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name"
          aria-label="Search files"
        />
      </InputGroup>
      <div className="flex max-h-80 flex-col overflow-y-auto rounded-lg border">
        {files.map((f) => {
          const ok = !accept || accept(f);
          return (
            <label
              key={f.id}
              className={`flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 ${ok ? "cursor-pointer hover:bg-muted" : "opacity-50"}`}
            >
              <input
                type={single ? "radio" : "checkbox"}
                checked={chosen.includes(f.id)}
                disabled={!ok}
                onChange={() => onToggle(f.id)}
                className="accent-primary"
              />
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {formatBytes(f.size)}
              </span>
            </label>
          );
        })}
        {loading && (
          <Loader2Icon className="m-3 size-4 animate-spin text-muted-foreground" />
        )}
        {!loading && files.length === 0 && (
          <p className="p-3 text-muted-foreground text-sm">
            {error ?? "No files yet."}
          </p>
        )}
      </div>
      {onMore && (
        <Button variant="ghost" size="sm" onClick={onMore}>
          Show more files
        </Button>
      )}
    </>
  );
}
