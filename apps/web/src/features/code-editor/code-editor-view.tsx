"use client";

import { RefreshCwIcon, XIcon } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditorPane } from "./editor-pane";
import { FileTree } from "./file-tree";
import { SidePanes } from "./side-panes";
import { useCodeEditor } from "./use-code-editor";

/**
 * The full-page code editor over a bot's sandbox: files on the left, the open file in the middle, the bot's commands
 * and the app preview on the right. While it is open the sandbox stays awake; Escape or the close button leaves.
 */
export function CodeEditorView({
  botId,
  botName,
  onClose,
}: {
  botId: string;
  botName: string;
  onClose: () => void;
}) {
  const e = useCodeEditor(botId);

  useEffect(() => {
    const onKey = (k: KeyboardEvent) => k.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${botName}'s code`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">{botName}&apos;s sandbox</span>
        <Badge variant={e.socket.state === "open" ? "default" : "secondary"}>
          {e.socket.state === "open"
            ? "Live"
            : e.socket.state === "connecting"
              ? "Connecting…"
              : "Offline"}
        </Badge>
        {(e.error || e.socket.error) && (
          <span role="alert" className="truncate text-xs text-destructive">
            {e.error ?? e.socket.error}
          </span>
        )}
        <span className="flex-1" />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Refresh files"
          onClick={() => void e.refreshTree()}
        >
          <RefreshCwIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close the code editor"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-r py-1">
          <FileTree
            entries={e.tree}
            current={e.doc?.path}
            onOpen={(p) => void e.open(p)}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <EditorPane
            doc={e.doc}
            stale={e.stale}
            onChange={e.edit}
            onSave={() => void e.save()}
            onReload={() => e.doc && void e.open(e.doc.path)}
            onOverwrite={() => void e.overwrite()}
          />
        </main>
        <aside className="hidden w-[28rem] shrink-0 flex-col border-l lg:flex">
          <SidePanes botId={botId} terminal={e.terminal} />
        </aside>
      </div>
    </div>
  );
}
