"use client";

import {
  findLeakedKeys,
  toPortable,
} from "@backend/modules/workflows/graph/portable";
import { DownloadIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { flowToGraph } from "../flow";
import { useBuilder } from "../store";

/** A safe file name from the workflow's name: "New lead → Slack" → "new-lead-slack.k4-workflow.json". */
function fileName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "workflow"}.k4-workflow.json`;
}

/**
 * The workflow as a shareable JSON file, rebuilt from the canvas on every change (read only). Accounts, bots, files,
 * sample data and secrets are never in it.
 */
export function JsonExport() {
  const nodes = useBuilder((s) => s.nodes);
  const edges = useBuilder((s) => s.edges);
  const name = useBuilder((s) => s.workflow?.name ?? "Workflow");
  const description = useBuilder((s) => s.workflow?.description ?? "");

  const { json, leaks } = useMemo(() => {
    const graph = flowToGraph(nodes, edges);
    const doc = toPortable({ name, description, graph });
    return {
      json: JSON.stringify(doc, null, 2),
      leaks: findLeakedKeys(doc.graph),
    };
  }, [nodes, edges, name, description]);

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(name);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Updates as you edit. Your connected accounts, bots, files, sample data
        and secrets are left out: whoever imports it connects their own.
      </p>
      {leaks.length > 0 && (
        <output className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
          <span>
            {leaks.join(", ")} {leaks.length === 1 ? "looks" : "look"} like{" "}
            {leaks.length === 1 ? "it holds" : "they hold"} a key or token typed
            in directly. Move it to a secret before sharing this file.
          </span>
        </output>
      )}
      <CodeBlock size="sm" className="min-h-0 flex-1">
        <CodeBlockHeader>
          <CodeBlockTitle>{fileName(name)}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={json} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent lineNumbers className="min-h-0 flex-1">
          {json}
        </CodeBlockContent>
      </CodeBlock>
      <Button variant="outline" onClick={download}>
        <DownloadIcon />
        Download JSON
      </Button>
    </div>
  );
}
