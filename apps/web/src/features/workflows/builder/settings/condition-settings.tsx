"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockBody } from "../blocks";
import { ConditionGroup } from "./condition-group";
import type { Cond } from "./condition-ops";
import { ConditionRow } from "./condition-row";
import { SettingsSection } from "./field";

type CondBlock = Extract<BlockBody, { kind: "logic.if" | "logic.filter" }>;

/** If / Filter: rows of "value · comparison · value", all or any of which must hold. */
export function ConditionSettings({
  block,
  update,
}: {
  block: CondBlock;
  update: (b: CondBlock) => void;
}) {
  const { conditions, combine } = block.config;
  const groups = block.config.groups ?? [];
  const set = (next: Cond[], c = combine, g = groups) =>
    update({
      ...block,
      config: { combine: c, conditions: next, groups: g },
    } as CondBlock);
  const edit = (i: number, patch: Partial<Cond>) =>
    set(conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <SettingsSection
      title={
        block.kind === "logic.if"
          ? "Take the true path when"
          : "Continue only when"
      }
    >
      <Select
        value={combine}
        onValueChange={(v) => set(conditions, v as "all" | "any")}
      >
        <SelectTrigger className="w-full" aria-label="Match">
          <SelectValue>
            {combine === "all"
              ? "All of these are true"
              : "Any of these is true"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All of these are true</SelectItem>
          <SelectItem value="any">Any of these is true</SelectItem>
        </SelectContent>
      </Select>
      {conditions.map((c, i) => (
        <ConditionRow
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are controlled and hold no state; two empty rows have identical content, so content cannot be the key
          key={i}
          cond={c}
          index={i}
          total={conditions.length}
          onChange={(patch) => edit(i, patch)}
          onRemove={() => set(conditions.filter((_, j) => j !== i))}
        />
      ))}
      {groups.map((g, i) => (
        <ConditionGroup
          // biome-ignore lint/suspicious/noArrayIndexKey: groups have no id; their place is their identity
          key={i}
          group={g}
          index={i}
          onChange={(next) =>
            set(
              conditions,
              combine,
              groups.map((x, j) => (j === i ? next : x)),
            )
          }
          onRemove={() =>
            set(
              conditions,
              combine,
              groups.filter((_, j) => j !== i),
            )
          }
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {conditions.length < 10 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set([...conditions, { left: "", op: "equals", right: "" }])
            }
          >
            <PlusIcon />
            Add condition
          </Button>
        )}
        {groups.length < 5 && (
          <Button
            size="sm"
            variant="ghost"
            title="A group counts as one condition with its own all / any, e.g. A and (B or C)"
            onClick={() =>
              set(conditions, combine, [
                ...groups,
                {
                  combine: "any",
                  conditions: [{ left: "", op: "equals", right: "" }],
                },
              ])
            }
          >
            <PlusIcon />
            Add group
          </Button>
        )}
      </div>
    </SettingsSection>
  );
}
