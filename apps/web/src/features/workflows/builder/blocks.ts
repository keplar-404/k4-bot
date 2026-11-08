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
  "action.app": "app",
  "action.http": "http",
  "logic.if": "if",
  "logic.filter": "filter",
  "logic.delay": "delay",
  "logic.set": "set",
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

/** A new block of this kind with sensible defaults. */
export function newBlock(
  kind: BlockKind,
  position: { x: number; y: number },
  id: string,
  toolkit?: string,
): Block {
  const base = { id, position };
  switch (kind) {
    case "trigger.manual":
    case "trigger.webhook":
      return { ...base, kind, config: {} };
    case "trigger.schedule":
      return {
        ...base,
        kind,
        config: { every: 1, unit: "hours", timezone: "UTC" },
      };
    case "action.app":
      return {
        ...base,
        kind,
        config: { toolkit, arguments: {} },
        onError: "stop",
      };
    case "action.http":
      return {
        ...base,
        kind,
        config: {
          method: "GET",
          url: "",
          headers: [],
          body: { type: "none", value: "" },
          timeoutSeconds: 15,
          expect: "json",
        },
        onError: "stop",
      };
    case "logic.if":
    case "logic.filter":
      return {
        ...base,
        kind,
        config: {
          combine: "all",
          conditions: [{ left: "", op: "equals", right: "" }],
        },
      };
    case "logic.delay":
      return { ...base, kind, config: { amount: 5, unit: "minutes" } };
    case "logic.set":
      return {
        ...base,
        kind,
        config: { fields: [{ key: "value", value: "" }] },
      };
  }
}
