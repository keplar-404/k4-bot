"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { BlockBody } from "../blocks";
import { useBuilder } from "../store";
import { SettingsSection } from "./field";
import { SwitchRule } from "./switch-rule";

type SwitchBlock = Extract<BlockBody, { kind: "logic.switch" }>;
type Rule = SwitchBlock["config"]["rules"][number];

const MAX_RULES = 10;
const nextId = (rules: Rule[]) => {
  for (let n = rules.length + 1; ; n++)
    if (!rules.some((r) => r.id === `path_${n}`)) return `path_${n}`;
};

/**
 * Switch: paths checked in order; the first whose conditions hold is taken. Each path is an output on the block;
 * connect the blocks for that case below it. "Otherwise" catches everything else.
 */
export function SwitchSettings({
  block,
  update,
}: {
  block: SwitchBlock;
  update: (b: SwitchBlock) => void;
}) {
  const { rules, otherwise } = block.config;
  const set = (patch: Partial<SwitchBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  const setRule = (i: number, patch: Partial<Rule>) =>
    set({ rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <SettingsSection title="Paths, checked in order">
      {rules.map((rule, i) => (
        <SwitchRule
          key={rule.id}
          rule={rule}
          index={i}
          canRemove={rules.length > 1}
          onChange={(patch) => setRule(i, patch)}
          onRemove={() => {
            set({ rules: rules.filter((_, j) => j !== i) });
            // Its output goes, so do the connections leaving from it.
            useBuilder.setState((st) => ({
              edges: st.edges.filter(
                (e) => !(e.source === block.id && e.sourceHandle === rule.id),
              ),
            }));
          }}
        />
      ))}
      {rules.length < MAX_RULES && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            set({
              rules: [
                ...rules,
                {
                  id: nextId(rules),
                  label: "",
                  combine: "all",
                  conditions: [{ left: "", op: "equals", right: "" }],
                },
              ],
            })
          }
        >
          <PlusIcon /> Add path
        </Button>
      )}
      <label
        htmlFor="switch-otherwise"
        className="flex items-center justify-between gap-3 text-sm"
      >
        <span>
          Otherwise path
          <span className="block text-muted-foreground text-xs">
            Taken when no path matches. Off: nothing after the Switch runs.
          </span>
        </span>
        <Switch
          id="switch-otherwise"
          checked={otherwise}
          onCheckedChange={(v) => set({ otherwise: v })}
        />
      </label>
    </SettingsSection>
  );
}
