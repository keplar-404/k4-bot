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

type SetBlock = Extract<BlockBody, { kind: "logic.set" | "logic.return" }>;
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
          placeholder="Optional: pick a record with +"
          onChange={(b) => set(fields, b)}
        />
      </Field>
      <div className="@container flex flex-col gap-3">
        {fields.map((f, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are ordered and have no identity of their own
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-x-2 gap-y-1.5 border-l-2 pl-2.5 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_7rem_auto] @xl:border-l-0 @xl:pl-0"
          >
            <Input
              aria-label="Field name"
              placeholder="Field name, e.g. full_name"
              className="font-mono text-xs"
              value={f.key}
              onChange={(e) =>
                edit(i, { key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })
              }
            />
            <div className="col-span-3 row-start-2 min-w-0 @xl:col-span-1 @xl:row-start-auto">
              <TemplateInput
                aria-label={`Value of ${f.key || "this field"}`}
                placeholder={
                  f.type === "list"
                    ? "Items with commas: red, green, blue"
                    : f.type === "object"
                      ? '{"city": "Dhaka"}'
                      : "A value, or data with +"
                }
                value={f.value}
                onChange={(value) => edit(i, { value })}
              />
            </div>
            <Select
              value={f.type ?? "text"}
              onValueChange={(v) =>
                v && edit(i, { type: v as SetField["type"] })
              }
            >
              <SelectTrigger aria-label="Type" className="w-full">
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
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${f.key || "field"}`}
              onClick={() => set(fields.filter((_, j) => j !== i))}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>
      {fields.length < 20 && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-muted-foreground"
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
