"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlockBody } from "../blocks";
import type { Cond } from "./condition-ops";
import { ConditionRow } from "./condition-row";

type Group = Extract<
  BlockBody,
  { kind: "logic.if" }
>["config"]["groups"][number];

/** A nested group ("…and (B or C)"): its own all/any and rows. It counts as one condition of the block. */
export function ConditionGroup({
  group,
  index,
  onChange,
  onRemove,
}: {
  group: Group;
  index: number;
  onChange: (g: Group) => void;
  onRemove: () => void;
}) {
  const set = (conditions: Cond[]) => onChange({ ...group, conditions });
  return (
    <div className="flex flex-col gap-3 border-muted-foreground/30 border-l-2 border-dashed py-1 pl-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() =>
            onChange({
              ...group,
              combine: group.combine === "all" ? "any" : "all",
            })
          }
        >
          Group {index + 1}: {group.combine === "all" ? "all" : "any"} of these
          (switch to {group.combine === "all" ? "any" : "all"})
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remove group ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      {group.conditions.map((c, k) => (
        <ConditionRow
          // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows with no state of their own
          key={k}
          cond={c}
          index={1000 + index * 100 + k}
          total={group.conditions.length}
          onChange={(patch) =>
            set(
              group.conditions.map((x, j) =>
                j === k ? { ...x, ...patch } : x,
              ),
            )
          }
          onRemove={() => set(group.conditions.filter((_, j) => j !== k))}
        />
      ))}
      {group.conditions.length < 10 && (
        <Button
          size="xs"
          variant="ghost"
          className="self-start"
          onClick={() =>
            set([...group.conditions, { left: "", op: "equals", right: "" }])
          }
        >
          <PlusIcon /> Add condition to the group
        </Button>
      )}
    </div>
  );
}
