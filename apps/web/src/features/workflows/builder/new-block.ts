import type { Block, BlockKind } from "./blocks";

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
        config: {
          mode: "daily",
          every: 1,
          unit: "hours",
          at: "09:00",
          days: [1],
          dayOfMonth: 1,
          // The browser's own zone: a schedule set at "9:00" means 9:00 where the user is.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      };
    case "trigger.app":
      return { ...base, kind, config: { toolkit, config: {} } };
    case "ai.bot":
      return {
        ...base,
        kind,
        config: { prompt: "", output: "text", useApps: false, files: [] },
        onError: "stop",
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
    case "logic.loop":
      return { ...base, kind, config: { items: "", max: 50 } };
    case "logic.approval":
      return { ...base, kind, config: { message: "", timeoutHours: 24 } };
    case "logic.set":
      return {
        ...base,
        kind,
        config: { fields: [{ key: "value", value: "" }] },
      };
  }
}
