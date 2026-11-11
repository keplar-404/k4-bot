"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";
import { FORMAT_GROUPS, findOp } from "./format-ops";

type FormatBlock = Extract<BlockBody, { kind: "logic.format" }>;

/** Formatter: pick what to do, the value (data from earlier steps), and that operation's settings. */
export function FormatSettings({
  block,
  update,
}: {
  block: FormatBlock;
  update: (b: FormatBlock) => void;
}) {
  const { operation, input, options } = block.config;
  const set = (patch: Partial<FormatBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  const op = findOp(operation);
  return (
    <SettingsSection title="Format">
      <Field id="format-op" label="What to do">
        <Select
          value={operation}
          onValueChange={(v) =>
            v &&
            set({
              operation: v as FormatBlock["config"]["operation"],
              options: {},
            })
          }
        >
          <SelectTrigger id="format-op" className="w-full">
            <SelectValue>{op?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FORMAT_GROUPS.map((g) => (
              <SelectGroup key={g.group}>
                <SelectLabel>{g.group}</SelectLabel>
                {g.ops.map((o) => (
                  <SelectItem key={o.op} value={o.op}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        id="format-input"
        label="Value"
        required
        hint="Pick it with + or drag it from the Data tab."
      >
        <TemplateInput
          id="format-input"
          multiline
          value={input}
          onChange={(v) => set({ input: v })}
          placeholder="e.g. {{loop.item.sender}}"
        />
      </Field>
      {op?.options?.map((field) => (
        <Field key={field.key} id={`format-${field.key}`} label={field.label}>
          <Input
            id={`format-${field.key}`}
            value={options[field.key] ?? ""}
            placeholder={field.placeholder}
            maxLength={2000}
            onChange={(e) =>
              set({ options: { ...options, [field.key]: e.target.value } })
            }
          />
        </Field>
      ))}
      <p className="text-muted-foreground text-xs">
        Later blocks read the result as{" "}
        <code>{`{{steps.${block.id}.output.result}}`}</code>.
      </p>
    </SettingsSection>
  );
}
