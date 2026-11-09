"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BlockBody } from "../blocks";
import { ConditionRow } from "./condition-row";

type Rule = Extract<
  BlockBody,
  { kind: "logic.switch" }
>["config"]["rules"][number];

/** One Switch path: its name, its conditions, and whether all or any must hold. */
export function SwitchRule({
  rule,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  rule: Rule;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-medium text-xs">{index + 1}.</span>
        <Input
          aria-label="Path name"
          placeholder={rule.id}
          maxLength={60}
          value={rule.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        {canRemove && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove path"
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      {rule.conditions.map((c, k) => (
        <ConditionRow
          // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows with no state of their own
          key={k}
          cond={c}
          index={index * 100 + k}
          total={rule.conditions.length}
          onChange={(patch) =>
            onChange({
              conditions: rule.conditions.map((x, j) =>
                j === k ? { ...x, ...patch } : x,
              ),
            })
          }
          onRemove={() =>
            onChange({
              conditions: rule.conditions.filter((_, j) => j !== k),
            })
          }
        />
      ))}
      {rule.conditions.length < 10 && (
        <Button
          size="xs"
          variant="ghost"
          className="self-start"
          onClick={() =>
            onChange({
              conditions: [
                ...rule.conditions,
                { left: "", op: "equals", right: "" },
              ],
            })
          }
        >
          <PlusIcon /> {rule.combine === "all" ? "And" : "Or"} another condition
        </Button>
      )}
      {rule.conditions.length > 1 && (
        <Button
          size="xs"
          variant="ghost"
          className="self-start text-muted-foreground"
          onClick={() =>
            onChange({ combine: rule.combine === "all" ? "any" : "all" })
          }
        >
          Needs {rule.combine === "all" ? "all" : "any"} of these (switch to{" "}
          {rule.combine === "all" ? "any" : "all"})
        </Button>
      )}
    </div>
  );
}
