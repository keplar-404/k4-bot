"use client";

import { PlusIcon, XIcon } from "lucide-react";
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

type MergeBlock = Extract<BlockBody, { kind: "logic.merge" }>;
type Mode = MergeBlock["config"]["mode"];

const MODES: Array<{ mode: Mode; label: string; hint: string }> = [
  {
    mode: "append",
    label: "Append into one list",
    hint: "Lists are joined; a single value counts as one item. Read .output.items.",
  },
  {
    mode: "combine",
    label: "Combine into one object",
    hint: "Fields of every object together; later ones win. Read .output.result.",
  },
  {
    mode: "by_key",
    label: "Match two lists by a field",
    hint: "Each item of the first list gets the fields of the second list's item with the same key. Read .output.items.",
  },
  {
    mode: "first",
    label: "First one that has a value",
    hint: "Use after an If or Switch: takes whichever path ran. Read .output.result.",
  },
];

/** Merge: the values to bring together (usually one per path) and how. */
export function MergeSettings({
  block,
  update,
}: {
  block: MergeBlock;
  update: (b: MergeBlock) => void;
}) {
  const { mode, inputs, key } = block.config;
  const set = (patch: Partial<MergeBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  const setInput = (i: number, v: string) =>
    set({ inputs: inputs.map((x, j) => (j === i ? v : x)) });
  const current = MODES.find((m) => m.mode === mode);
  return (
    <SettingsSection title="Merge">
      <Field id="merge-mode" label="How to merge" hint={current?.hint}>
        <Select
          value={mode}
          onValueChange={(v) =>
            v &&
            set({
              mode: v as Mode,
              inputs: v === "by_key" ? inputs.slice(0, 2) : inputs,
            })
          }
        >
          <SelectTrigger id="merge-mode" className="w-full">
            <SelectValue>{current?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.mode} value={m.mode}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {inputs.map((value, i) => (
        <Field
          // biome-ignore lint/suspicious/noArrayIndexKey: inputs have no ids; their place is their identity
          key={i}
          id={`merge-in-${i}`}
          label={
            mode === "by_key"
              ? i === 0
                ? "First list"
                : "Second list"
              : `Value ${i + 1}`
          }
          required={i < 2}
        >
          <div className="flex items-center gap-1">
            <TemplateInput
              id={`merge-in-${i}`}
              value={value}
              placeholder="Pick a value with +"
              onChange={(v) => setInput(i, v)}
            />
            {i >= 2 && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove value ${i + 1}`}
                onClick={() =>
                  set({ inputs: inputs.filter((_, j) => j !== i) })
                }
              >
                <XIcon />
              </Button>
            )}
          </div>
        </Field>
      ))}
      {mode !== "by_key" && inputs.length < 5 && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => set({ inputs: [...inputs, ""] })}
        >
          <PlusIcon />
          Add a value
        </Button>
      )}
      {mode === "by_key" && (
        <Field
          id="merge-key"
          label="Field both lists share"
          required
          hint="For example id or email (a dot reaches inside: customer.id)."
        >
          <Input
            placeholder={"e.g. email"}
            id="merge-key"
            value={key}
            maxLength={100}
            onChange={(e) => set({ key: e.target.value })}
          />
        </Field>
      )}
    </SettingsSection>
  );
}
