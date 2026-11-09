"use client";

import { Input } from "@/components/ui/input";
import type { BlockBody } from "../blocks";
import { Field, SettingsSection } from "./field";

type LoopBlock = Extract<BlockBody, { kind: "logic.loop" }>;

/** For each: which list to go through, and at most how many items. Every block after it runs once per item. */
export function LoopSettings({
  block,
  update,
}: {
  block: LoopBlock;
  update: (b: LoopBlock) => void;
}) {
  const set = (patch: Partial<LoopBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  return (
    <SettingsSection title="Go through">
      <Field
        id="loop-items"
        label="The list"
        required
        hint="Copy a list field from the Data tab, e.g. {{steps.sheets_1.output.data.rows}}. Every block connected after this one runs once per item, one item after another."
      >
        <Input
          id="loop-items"
          className="font-mono text-xs"
          value={block.config.items}
          placeholder="{{steps.….output.items}}"
          maxLength={4000}
          onChange={(e) => set({ items: e.target.value })}
        />
      </Field>
      <Field
        id="loop-max"
        label="At most"
        hint="Items after this many are left out (up to 100)."
      >
        <Input
          id="loop-max"
          type="number"
          min={1}
          max={100}
          value={block.config.max}
          onChange={(e) =>
            set({
              max: Math.min(
                100,
                Math.max(1, Number.parseInt(e.target.value, 10) || 1),
              ),
            })
          }
        />
      </Field>
      <p className="text-muted-foreground text-xs">
        In the blocks after it, use <code>{"{{loop.item}}"}</code> (or{" "}
        <code>{"{{loop.item.email}}"}</code>), <code>{"{{loop.index}}"}</code>{" "}
        (0, 1, 2…) and <code>{"{{loop.count}}"}</code>. One For each per
        workflow.
      </p>
    </SettingsSection>
  );
}
