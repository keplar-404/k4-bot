import type { SandboxRow } from "@/features/sandboxes/api";

/** What the sandbox is for, when it was last used, and its running time today. */
export function SandboxDetails({ row }: { row: Omit<SandboxRow, "botName"> }) {
  const today =
    row.usageDay === new Date().toISOString().slice(0, 10)
      ? Math.round(row.usageSeconds / 60)
      : 0;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted-foreground">Purpose</dt>
      <dd>{row.purpose}</dd>
      <dt className="text-muted-foreground">Last used</dt>
      <dd>{new Date(row.lastUsedAt).toLocaleString()}</dd>
      <dt className="text-muted-foreground">Today</dt>
      <dd>{today} min</dd>
    </dl>
  );
}
