"use client";

import { ListTreeIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_SUBAGENTS } from "@/features/bots/domains";
import { type Capabilities, one } from "./capabilities";

/** May the bot spawn a group of sub-agents, and how large a group. */
export function SubagentsSetting({
  value,
  onChange,
}: {
  value: Capabilities;
  onChange: (next: Capabilities) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="cap-subagents"
          className="flex items-center gap-2 text-sm"
        >
          <ListTreeIcon className="size-4 text-muted-foreground" />
          Spawn sub-agents
        </label>
        <Switch
          id="cap-subagents"
          checked={value.subagentsEnabled}
          onCheckedChange={(checked) =>
            onChange({ ...value, subagentsEnabled: checked })
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The bot can split big jobs across a group of sub-agents that work in
        parallel, each with its own context, skills and apps. Uses more of your
        daily tokens.
      </p>
      {value.subagentsEnabled && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Largest group</span>
            <span className="font-medium tabular-nums">
              {value.maxSubagents} sub-agent
              {value.maxSubagents === 1 ? "" : "s"}
            </span>
          </div>
          <Slider
            min={1}
            max={MAX_SUBAGENTS}
            step={1}
            value={[value.maxSubagents]}
            onValueChange={(v) => onChange({ ...value, maxSubagents: one(v) })}
            aria-label="Largest sub-agent group"
          />
        </div>
      )}
    </div>
  );
}
