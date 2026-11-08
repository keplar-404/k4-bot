"use client";

import { useRunView } from "./run-view-store";

const show = (v: unknown) =>
  v === undefined || v === null ? null : JSON.stringify(v, null, 2);

/** What each block of the viewed run was given and returned (secrets are already replaced by [secret:NAME] on the server). */
export function StepIo() {
  const detail = useRunView((s) => s.detail);
  if (!detail) return null;
  return (
    <div className="flex flex-col gap-1 p-2 pt-0">
      {detail.steps.map((s) => {
        const input = show(s.input);
        const output = show(s.output);
        if (!input && !output) return null;
        return (
          <details key={s.nodeId} className="rounded border p-2 text-xs">
            <summary className="cursor-pointer font-medium">
              {s.nodeId} · input / output
            </summary>
            {input && (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                {input}
              </pre>
            )}
            {output && (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                {output}
              </pre>
            )}
          </details>
        );
      })}
    </div>
  );
}
