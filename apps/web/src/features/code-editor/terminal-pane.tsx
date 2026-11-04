"use client";

import type { TerminalLine } from "./types";

/** The commands the bot ran in the sandbox, newest last, with their exit code and the end of their output. */
export function TerminalPane({ lines }: { lines: TerminalLine[] }) {
  if (lines.length === 0)
    return (
      <p className="p-3 text-xs text-muted-foreground">
        Commands the bot runs show up here.
      </p>
    );
  return (
    <div
      className="h-full min-h-0 overflow-y-auto bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
      aria-live="polite"
    >
      {lines.map((l) => (
        <div key={l.at} className="mb-2">
          <div className="text-emerald-400">$ {l.command}</div>
          {l.output && (
            <pre className="whitespace-pre-wrap text-zinc-300">{l.output}</pre>
          )}
          {l.exitCode !== 0 && (
            <div className="text-red-400">exit {l.exitCode}</div>
          )}
        </div>
      ))}
    </div>
  );
}
