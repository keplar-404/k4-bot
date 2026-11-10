import type { Block, BlockKind } from "./blocks";
import { newDataBlock } from "./new-data-block";

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
      return { ...base, kind, config: { fields: [] } };
    case "trigger.webhook":
      return {
        ...base,
        kind,
        config: {
          auth: "none",
          headerName: "x-webhook-secret",
          signatureHeader: "x-signature",
          signaturePrefix: "sha256=",
          ipAllowlist: [],
        },
      };
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
          query: [],
          auth: {
            type: "none",
            token: "",
            username: "",
            headerName: "X-API-Key",
          },
          pagination: {
            mode: "none",
            param: "page",
            start: 1,
            itemsPath: "",
            nextPath: "",
            maxPages: 5,
          },
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
          groups: [],
        },
      };
    case "logic.delay":
      return {
        ...base,
        kind,
        config: {
          mode: "for",
          amount: 5,
          unit: "minutes",
          until: "",
          days: [1],
          at: "09:00",
          timezone: "UTC",
        },
      };
    case "ai.decide":
      return {
        ...base,
        kind,
        config: {
          model: "jev-latest",
          state: "",
          questions: [
            {
              id: "answer",
              type: "noul",
              instructions: "",
              choices: [],
              levels: [],
            },
          ],
        },
        onError: "stop",
      };
    case "logic.loop":
      return { ...base, kind, config: { items: "", max: 50 } };
    case "logic.approval":
      return {
        ...base,
        kind,
        config: { message: "", timeoutHours: 24, onTimeout: "fail" },
      };
    case "logic.set":
      return {
        ...base,
        kind,
        config: {
          fields: [{ key: "value", value: "", type: "text" }],
          base: "",
        },
      };
    default:
      return newDataBlock(kind, base);
  }
}
