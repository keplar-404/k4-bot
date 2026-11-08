"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Cond } from "./condition-ops";
import { OPS, UNARY } from "./condition-ops";

export function ConditionRow({
  cond,
  index,
  total,
  onChange,
  onRemove,
}: {
  cond: Cond;
  index: number;
  total: number;
  onChange: (patch: Partial<Cond>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2.5">
      <Input
        aria-label="Value to check"
        placeholder="{{steps.x.output.status}}"
        value={cond.left}
        onChange={(e) => onChange({ left: e.target.value })}
      />
      <Select
        value={cond.op}
        onValueChange={(v) => onChange({ op: v as Cond["op"] })}
      >
        <SelectTrigger className="w-full" aria-label="Comparison">
          <SelectValue>{OPS.find(([o]) => o === cond.op)?.[1]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPS.map(([op, label]) => (
            <SelectItem key={op} value={op}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!UNARY.has(cond.op) && (
        <Input
          aria-label="Compare with"
          placeholder="e.g. paid"
          value={cond.right ?? ""}
          onChange={(e) => onChange({ right: e.target.value })}
        />
      )}
      {total > 1 && (
        <Button
          size="xs"
          variant="ghost"
          className="self-end text-muted-foreground"
          onClick={onRemove}
        >
          <Trash2Icon />
          Remove
        </Button>
      )}
    </div>
  );
}
