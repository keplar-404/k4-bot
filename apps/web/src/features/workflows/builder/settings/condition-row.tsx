"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TemplateInput } from "../template/template-input";
import type { Cond } from "./condition-ops";
import {
  OP_GROUPS,
  OPS,
  RIGHT_PLACEHOLDER,
  TEXTUAL,
  UNARY,
} from "./condition-ops";

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
    <div className="flex flex-col gap-2 border-l-2 py-0.5 pl-3">
      <TemplateInput
        aria-label="Value to check"
        placeholder="What to check: pick data with +, e.g. the email subject"
        value={cond.left}
        onChange={(left) => onChange({ left })}
      />
      <Select
        value={cond.op}
        onValueChange={(v) => onChange({ op: v as Cond["op"] })}
      >
        <SelectTrigger className="w-full" aria-label="Comparison">
          <SelectValue>{OPS.find(([o]) => o === cond.op)?.[1]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OP_GROUPS.map((g) => (
            <SelectGroup key={g.group}>
              <SelectLabel>{g.group}</SelectLabel>
              {g.ops.map(([op, label]) => (
                <SelectItem key={op} value={op}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {!UNARY.has(cond.op) && (
        <TemplateInput
          aria-label="Compare with"
          placeholder={
            RIGHT_PLACEHOLDER[cond.op] ??
            "Compare with: a value like paid, or data with +"
          }
          value={cond.right ?? ""}
          onChange={(right) => onChange({ right })}
        />
      )}
      {TEXTUAL.has(cond.op) && (
        <label
          htmlFor={`cond-case-${index}`}
          className="flex items-center gap-2 text-muted-foreground text-xs"
        >
          <Switch
            id={`cond-case-${index}`}
            size="sm"
            checked={cond.caseSensitive ?? false}
            onCheckedChange={(v) => onChange({ caseSensitive: v || undefined })}
          />
          Match upper and lower case exactly
        </label>
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
