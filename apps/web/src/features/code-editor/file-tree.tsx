"use client";

import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TreeEntry } from "./api";
import { buildTree, type TreeNode } from "./tree-model";

type BranchProps = {
  node: TreeNode;
  depth: number;
  current?: string;
  onOpen: (path: string) => void;
};

const ROW =
  "flex w-full items-center py-0.5 pr-2 text-left text-xs hover:bg-muted";

function Branch({ node, depth, current, onOpen }: BranchProps) {
  const [open, setOpen] = useState(depth === 0);
  const pad = { paddingLeft: `${depth * 12 + 8}px` };
  if (!node.dir) {
    return (
      <button
        type="button"
        style={pad}
        onClick={() => onOpen(node.path)}
        className={cn(
          ROW,
          "gap-1.5",
          current?.endsWith(`/${node.path}`) && "bg-muted font-medium",
        )}
      >
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        type="button"
        style={pad}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(ROW, "gap-1")}
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
      {open &&
        node.children.map((c) => (
          <Branch
            key={c.path}
            node={c}
            depth={depth + 1}
            current={current}
            onOpen={onOpen}
          />
        ))}
    </div>
  );
}

/** The sandbox's files under /home/user (node_modules, .git and build output are left out). */
export function FileTree({
  entries,
  current,
  onOpen,
}: {
  entries: TreeEntry[];
  current?: string;
  onOpen: (path: string) => void;
}) {
  const nodes = buildTree(entries);
  if (nodes.length === 0)
    return <p className="p-3 text-xs text-muted-foreground">No files yet.</p>;
  return (
    <nav aria-label="Files">
      {nodes.map((n) => (
        <Branch
          key={n.path}
          node={n}
          depth={0}
          current={current}
          onOpen={onOpen}
        />
      ))}
    </nav>
  );
}
