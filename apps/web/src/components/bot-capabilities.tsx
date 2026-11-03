"use client";

import { ListTreeIcon, ZapIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_PARALLEL_TOOLS, MAX_SUBAGENTS } from "@/lib/domains";

export interface Capabilities {
  subagentsEnabled: boolean;
  maxSubagents: number;
  maxParallelTools: number;
}

const one = (v: number | readonly number[]) =>
  (Array.isArray(v) ? v[0] : v) as number;

/**
 * How a bot works: how many tool calls it runs at once, and whether it may spawn a group of sub-agents (each with
 * its own context, skills and apps). The role sets the starting values; the user can change them.
 */
export function BotCapabilities({
  value,
  onChange,
}: {
  value: Capabilities;
  onChange: (next: Capabilities) => void;
}) {
  return (
    <fieldset className="w-full space-y-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">Capabilities</legend>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="cap-parallel"
            className="flex items-center gap-2 text-sm"
          >
            <ZapIcon className="size-4 text-muted-foreground" />
            Parallel tool calls
          </label>
          <span className="text-sm font-medium tabular-nums">
            {value.maxParallelTools}
          </span>
        </div>
        <Slider
          id="cap-parallel"
          min={1}
          max={MAX_PARALLEL_TOOLS}
          step={1}
          value={[value.maxParallelTools]}
          onValueChange={(v) =>
            onChange({ ...value, maxParallelTools: one(v) })
          }
          aria-label="Parallel tool calls"
        />
        <p className="text-xs text-muted-foreground">
          How many searches, page reads or other tool calls the bot runs at the
          same time. More is faster for research.
        </p>
      </div>

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
          parallel, each with its own context, skills and apps. Uses more of
          your daily tokens.
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
              onValueChange={(v) =>
                onChange({ ...value, maxSubagents: one(v) })
              }
              aria-label="Largest sub-agent group"
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}
