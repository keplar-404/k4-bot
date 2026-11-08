"use client";

import { CircleCheckIcon, ListChecksIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBuilder } from "../store";

/** What still stops the workflow from being turned on. Picking one selects the block it is about. */
export function IssuesMenu() {
  const issues = useBuilder((s) => s.workflow?.issues ?? []);
  const { nodes, onNodesChange, select } = useBuilder();
  if (issues.length === 0) {
    return (
      <span className="hidden items-center gap-1.5 text-emerald-600 text-xs md:flex dark:text-emerald-400">
        <CircleCheckIcon className="size-3.5" />
        Ready to turn on
      </span>
    );
  }
  const focus = (id?: string) => {
    if (!id) return;
    onNodesChange(
      nodes.map((n) => ({
        type: "select" as const,
        id: n.id,
        selected: n.id === id,
      })),
    );
    select(id);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <ListChecksIcon />
        {issues.length} to finish
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Before it can be turned on</DropdownMenuLabel>
          {issues.map((i, k) => (
            <DropdownMenuItem
              key={`${i.nodeId ?? "graph"}:${i.message}:${k}`}
              onClick={() => focus(i.nodeId)}
              className="items-start whitespace-normal"
            >
              {i.message}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
