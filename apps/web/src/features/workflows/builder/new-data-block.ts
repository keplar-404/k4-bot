import type { Block, BlockKind } from "./blocks";

type DataKind = Extract<
  BlockKind,
  "logic.format" | "logic.merge" | "logic.list" | "logic.switch" | "action.code"
>;

/** Defaults for the blocks that reshape or route data (Formatter, Merge, List tools, Switch, Code). */
export function newDataBlock(
  kind: DataKind,
  base: { id: string; position: { x: number; y: number } },
): Block {
  switch (kind) {
    case "action.code":
      return {
        ...base,
        kind,
        config: {
          code: "// `input` holds the fields below. Return the result.\nreturn { total: (input.items ?? []).length };",
          inputs: [],
          timeoutSeconds: 30,
        },
        onError: "stop",
      };
    case "logic.format":
      return {
        ...base,
        kind,
        config: { operation: "trim", input: "", options: {} },
      };
    case "logic.merge":
      return {
        ...base,
        kind,
        config: { mode: "append", inputs: ["", ""], key: "" },
      };
    case "logic.list":
      return {
        ...base,
        kind,
        config: {
          operation: "pluck",
          input: "",
          field: "",
          order: "asc",
          amount: 10,
        },
      };
    case "logic.switch":
      return {
        ...base,
        kind,
        config: {
          rules: [
            {
              id: "path_1",
              label: "",
              combine: "all",
              conditions: [{ left: "", op: "equals", right: "" }],
            },
            {
              id: "path_2",
              label: "",
              combine: "all",
              conditions: [{ left: "", op: "equals", right: "" }],
            },
          ],
          otherwise: true,
        },
      };
  }
}
