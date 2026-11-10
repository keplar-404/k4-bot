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
import { Switch } from "@/components/ui/switch";
import type { BlockBody } from "../blocks";
import { SettingsSection } from "./field";

type ManualBlock = Extract<BlockBody, { kind: "trigger.manual" }>;
type FormField = ManualBlock["config"]["fields"][number];

export const FIELD_TYPES: Record<FormField["type"], string> = {
  text: "Text",
  number: "Number",
  yes_no: "Yes / no",
  list: "List",
};
/** A field key from its label: "Customer email" → customer_email. */
const keyOf = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1")
    .slice(0, 40) || "field";

/** The manual trigger's form: what you (or a bot) fill in when starting a run, read as {{trigger.inputs.key}}. */
export function ManualFormSettings({
  block,
  update,
}: {
  block: ManualBlock;
  update: (b: ManualBlock) => void;
}) {
  const fields = block.config.fields;
  const setFields = (next: FormField[]) =>
    update({ ...block, config: { fields: next } });
  const edit = (i: number, patch: Partial<FormField>) =>
    setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <SettingsSection title="Form">
      <p className="text-muted-foreground text-xs">
        Optional. Each field is asked when the run starts and read in later
        steps as <code>{"{{trigger.inputs.key}}"}</code>. Bots fill it in too.
      </p>
      {fields.map((f, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fields are edited in place; the key text itself changes
          key={i}
          className="flex flex-col gap-2 border-l-2 py-0.5 pl-3"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <Input
              aria-label="Field label"
              placeholder="Question to ask, e.g. Customer email"
              value={f.label}
              maxLength={80}
              onChange={(e) =>
                edit(i, { label: e.target.value, key: keyOf(e.target.value) })
              }
            />
            <Select
              value={f.type}
              onValueChange={(v) =>
                v && edit(i, { type: v as FormField["type"] })
              }
            >
              <SelectTrigger aria-label="Field type" className="w-28">
                <SelectValue>{FIELD_TYPES[f.type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FIELD_TYPES).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove field"
              onClick={() => setFields(fields.filter((_, j) => j !== i))}
            >
              <Trash2Icon />
            </Button>
          </div>
          <Input
            aria-label="Help text"
            placeholder="Help text (optional), e.g. Their work email"
            value={f.help ?? ""}
            maxLength={200}
            className="h-8 text-xs"
            onChange={(e) => edit(i, { help: e.target.value })}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <code className="truncate">{`{{trigger.inputs.${f.key}}}`}</code>
            <label
              className="flex items-center gap-1.5"
              htmlFor={`form-req-${i}`}
            >
              Required
              <Switch
                id={`form-req-${i}`}
                checked={f.required}
                onCheckedChange={(required) => edit(i, { required })}
              />
            </label>
          </div>
        </div>
      ))}
      {fields.length < 20 && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() =>
            setFields([
              ...fields,
              {
                key: `field_${fields.length + 1}`,
                label: "",
                type: "text",
                required: false,
                help: "",
              },
            ])
          }
        >
          <PlusIcon />
          Add a field
        </Button>
      )}
    </SettingsSection>
  );
}
