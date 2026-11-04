"use client";

import { CompassIcon } from "lucide-react";
import { TabIcon } from "./tab-icons";
import type { PickableKind } from "./types";
import { useWorkspace } from "./use-workspace";

const CHOICES: { kind: PickableKind; title: string; hint: string }[] = [
  {
    kind: "computer",
    title: "Computer",
    hint: "Watch and share this bot's desktop",
  },
  {
    kind: "browser",
    title: "Browser",
    hint: "Open a web page beside the chat",
  },
  { kind: "files", title: "Files", hint: "Browse this bot's stored files" },
  { kind: "code", title: "Code", hint: "Edit files in the bot's sandbox" },
];

/** What a new tab offers: one card per tool. Picking one turns this tab into it. */
export function StartTab({ id }: { id: string }) {
  const { pick } = useWorkspace();
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-4">
      <CompassIcon className="size-12 text-muted-foreground/40" />
      <div className="flex w-full max-w-sm flex-col gap-3">
        {CHOICES.map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => pick(id, c.kind)}
            className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <TabIcon kind={c.kind} className="size-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{c.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
