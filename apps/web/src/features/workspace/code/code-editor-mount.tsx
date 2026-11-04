"use client";

import dynamic from "next/dynamic";
import { useBotList } from "@/features/bots/hooks/use-bot-list";
import { useWorkspace } from "../use-workspace";

// The editor (CodeMirror and its languages) loads only when it is opened.
const CodeEditorView = dynamic(
  () =>
    import("@/features/code-editor/code-editor-view").then(
      (m) => m.CodeEditorView,
    ),
  { ssr: false },
);

/** The full-page code editor of this bot, shown over the page while the workspace says it is open. */
export function CodeEditorMount({ botId }: { botId: string }) {
  const { editorOpen, setEditorOpen } = useWorkspace();
  const { bots } = useBotList();
  if (!editorOpen) return null;
  const name = bots.find((b) => b.id === botId)?.name ?? "This bot";
  return (
    <CodeEditorView
      botId={botId}
      botName={name}
      onClose={() => setEditorOpen(false)}
    />
  );
}
