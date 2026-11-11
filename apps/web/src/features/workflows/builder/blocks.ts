import type { WorkflowGraph } from "../api";

export type Block = WorkflowGraph["nodes"][number];
export type BlockKind = Block["kind"];
/** A block without its canvas position. Distributive: TS's Omit would merge the union's members into one. */
export type BlockBody = Block extends infer B
  ? B extends unknown
    ? Omit<B, "position">
    : never
  : never;

const short: Record<BlockKind, string> = {
  "trigger.manual": "trigger",
  "trigger.schedule": "trigger",
  "trigger.webhook": "trigger",
  "trigger.app": "event",
  "action.app": "app",
  "action.http": "http",
  "action.code": "code",
  "logic.if": "if",
  "logic.filter": "filter",
  "logic.delay": "delay",
  "logic.set": "set",
  "logic.return": "return",
  "ai.bot": "ai",
  "logic.loop": "each",
  "logic.approval": "ask",
  "ai.decide": "decide",
  "logic.switch": "switch",
  "logic.format": "format",
  "logic.merge": "merge",
  "logic.list": "list",
};

/** A readable, unique block id ("gmail_k3f9a"): it also names the block in `{{steps.<id>.…}}` references. */
export function newBlockId(
  kind: BlockKind,
  toolkit?: string,
  taken: Set<string> = new Set(),
): string {
  const base = (toolkit ?? short[kind])
    .replace(/[^A-Za-z0-9_]/g, "_")
    .slice(0, 24);
  for (;;) {
    const id = `${base}_${Math.random().toString(36).slice(2, 7)}`;
    if (!taken.has(id)) return id;
  }
}

export { newBlock } from "./new-block";
