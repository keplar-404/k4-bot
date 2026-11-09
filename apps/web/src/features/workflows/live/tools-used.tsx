"use client";

/** What an "Ask a bot" step looked up (its tool calls), from the `used` list in its output. */
export function ToolsUsed({ output }: { output: unknown }) {
  const used = (
    output as { used?: Array<{ tool: string; args: string }> } | null
  )?.used;
  if (!Array.isArray(used)) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-muted-foreground text-xs">
        What the bot did
      </span>
      {used.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Answered without looking anything up.
        </p>
      ) : (
        <ol className="flex list-decimal flex-col gap-0.5 pl-4 text-xs">
          {used.map((u, i) => (
            <li key={`${u.tool}-${i}`}>
              <code>{u.tool}</code>{" "}
              <span className="break-all text-muted-foreground">{u.args}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
