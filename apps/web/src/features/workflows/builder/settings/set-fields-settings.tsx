"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";

type SetBlock = Extract<BlockBody, { kind: "logic.set" }>;
type SetField = SetBlock["config"]["fields"][number];

const TYPES: Record<SetField["type"], string> = {
  text: "Text",
  number: "Number",
  yes_no: "Yes / no",
  list: "List",
  object: "Object",
};

/** Set fields: name typed values for later steps (`{{steps.<this>.output.<name>}}`), optionally on top of an object. */
export function SetFieldsSettings({
  block,
  update,
}: {
  block: SetBlock;
  update: (b: SetBlock) => void;
}) {
  const { fields, base = "" } = block.config;
  const set = (next: SetField[], b = base) =>
    update({ ...block, config: { fields: next, base: b } });
  const edit = (i: number, patch: Partial<SetField>) =>
    set(fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <SettingsSection title="Fields">
      <Field
        id="set-base"
        label="Start from (optional)"
        hint="An object from an earlier step: the output is a copy of it with these fields added or replaced. Empty: only these fields."
      >
        <TemplateInput
          id="set-base"
          value={base}
          placeholder="Pick an object with +"
          onChange={(b) => set(fields, b)}
        />
      </Field>
      {fields.map((f, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are ordered and have no identity of their own
          key={i}
          className="grid grid-cols-[1fr_1.6fr_auto_auto] items-center gap-2"
        >
          <Input
            aria-label="Field name"
            placeholder="name"
            value={f.key}
            onChange={(e) =>
              edit(i, { key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })
            }
          />
          <TemplateInput
            aria-label="Value"
            placeholder={
              f.type === "list"
                ? "a, b, c"
                : f.type === "object"
                  ? '{"a": 1}'
                  : "Text, or data with +"
            }
            value={f.value}
            onChange={(value) => edit(i, { value })}
          />
          <Select
            value={f.type ?? "text"}
            onValueChange={(v) => v && edit(i, { type: v as SetField["type"] })}
          >
            <SelectTrigger aria-label="Type" className="w-24">
              <SelectValue>{TYPES[f.type ?? "text"]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPES).map(([t, label]) => (
                <SelectItem key={t} value={t}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${f.key || "field"}`}
            onClick={() => set(fields.filter((_, j) => j !== i))}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      {fields.length < 20 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            set([
              ...fields,
              { key: `field${fields.length + 1}`, value: "", type: "text" },
            ])
          }
        >
          <PlusIcon />
          Add field
        </Button>
      )}
    </SettingsSection>
  );
}
