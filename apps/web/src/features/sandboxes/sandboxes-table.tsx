"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SandboxRow } from "./api";
import { SandboxActions } from "./sandbox-actions";
import type { SandboxAction } from "./use-sandboxes";

const today = () => new Date().toISOString().slice(0, 10);
const minutesToday = (r: SandboxRow) =>
  r.usageDay === today() ? Math.round(r.usageSeconds / 60) : 0;

/** One row per bot sandbox: owner bot, purpose, state, today's minutes, last use, and its actions. */
export function SandboxesTable({
  rows,
  busy,
  onAction,
  onDelete,
}: {
  rows: SandboxRow[];
  busy: string | null;
  onAction: (a: SandboxAction, botId: string) => void;
  onDelete: (row: SandboxRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bot</TableHead>
          <TableHead>Purpose</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Today</TableHead>
          <TableHead>Last used</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.botId} className="h-12">
            <TableCell className="font-medium">{r.botName}</TableCell>
            <TableCell className="max-w-64 truncate" title={r.purpose}>
              {r.purpose}
            </TableCell>
            <TableCell>
              <Badge variant={r.status === "running" ? "default" : "secondary"}>
                {r.status}
              </Badge>
            </TableCell>
            <TableCell>{minutesToday(r)} min</TableCell>
            <TableCell>{new Date(r.lastUsedAt).toLocaleString()}</TableCell>
            <TableCell className="text-right">
              <SandboxActions
                row={r}
                busy={busy === r.botId}
                onAction={onAction}
                onDelete={onDelete}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
