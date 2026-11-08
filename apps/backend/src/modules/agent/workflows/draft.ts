import { z } from "zod";
import { withPositions } from "../../workflows/graph/layout";
import { graphSchema } from "../../workflows/graph/schema";
import { structureIssues } from "../../workflows/graph/validate";

/** What the model writes: blocks without canvas positions and connections without ids. */
const nodeInput = z.object({
  id: z.string().max(40),
  kind: z.string().max(40),
  label: z.string().max(80).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  retry: z.record(z.string(), z.unknown()).optional(),
  onError: z.enum(["stop", "continue"]).optional(),
});
const edgeInput = z.object({
  source: z.string().max(40),
  target: z.string().max(40),
  branch: z.enum(["true", "false"]).optional(),
});
export const nodesField = z.array(nodeInput).min(1).max(50);
export const edgesField = z.array(edgeInput).max(100);

export const BLOCKS_HELP = [
  "Blocks: trigger.manual | trigger.schedule{every,unit,timezone} | trigger.webhook,",
  "action.app{toolkit,tool,version,arguments,connectedAccountId?},",
  "action.http{method,url,headers,body,timeoutSeconds,expect},",
  "logic.if | logic.filter{combine,conditions[{left,op,right}]}, logic.delay{amount,unit}, logic.set{fields[{key,value}]}.",
  "One trigger, no loops; connections from logic.if need branch true|false.",
].join(" ");
export const TEMPLATES_HELP =
  "In text fields use {{trigger.inputs.x}}, {{trigger.body.x}}, {{steps.<blockId>.output.x}} and {{secrets.NAME}}.";

/** Adds positions and edge ids, then lets the real schema judge it. Its message is what the model fixes. */
export function toGraph(nodes: z.infer<typeof nodesField>, edges: z.infer<typeof edgesField>) {
  const placed = withPositions(
    nodes.map((node) => ({ ...node, config: node.config ?? {} })),
    edges,
  );
  const withIds = edges.map((edge, i) => ({ id: `e${i + 1}`, ...edge }));
  const parsed = graphSchema.safeParse({ nodes: placed, edges: withIds });
  if (!parsed.success) return { error: z.prettifyError(parsed.error).slice(0, 1500) };

  const issue = structureIssues(parsed.data)[0];
  if (issue) return { error: issue.message };
  return { graph: parsed.data };
}
