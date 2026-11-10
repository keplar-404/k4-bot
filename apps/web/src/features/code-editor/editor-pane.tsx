"use client";

import type { Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import { SaveIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { languageFor } from "./languages";
import { saveKeymap } from "./save-keymap";
import { StaleBanner } from "./stale-banner";
import type { Doc } from "./types";

type Props = {
  doc: Doc | null;
  stale: boolean;
  onChange: (t: string) => void;
  onSave: () => void;
  onReload: () => void;
  onOverwrite: () => void;
};

/**
 * The open file. Ctrl/Cmd+S saves (a CodeMirror key binding). `stale`: the sandbox has a newer version (the agent
 * changed it while the user had unsaved edits, or a save hit a conflict); the user picks reload or keep.
 */
export function EditorPane({
  doc,
  stale,
  onChange,
  onSave,
  onReload,
  onOverwrite,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [{ lang }, , store] = useLocalStore(() => ({
    lang: [] as Extension[],
  }));
  const setLang = fieldSetter(store, "lang");
  const save = useRef(onSave);
  save.current = onSave;
  const path = doc?.path;

  useEffect(() => {
    if (path) void languageFor(path).then(setLang);
  }, [path, setLang]);
  const extensions = useMemo(
    () => [...lang, saveKeymap(() => save.current())],
    [lang],
  );

  if (!doc)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Pick a file on the left. What the bot writes appears here as it happens.
      </p>
    );
  const dirty = doc.text !== doc.saved;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {doc.path}
          {dirty && <span className="ml-1 text-amber-500">● unsaved</span>}
        </span>
        <Button size="sm" variant="outline" disabled={!dirty} onClick={onSave}>
          <SaveIcon />
          Save
        </Button>
      </div>
      {stale && <StaleBanner onReload={onReload} onOverwrite={onOverwrite} />}
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={doc.text}
          height="100%"
          theme={resolvedTheme === "dark" ? oneDark : "light"}
          extensions={extensions}
          onChange={onChange}
          className="h-full text-sm"
        />
      </div>
    </div>
  );
}
