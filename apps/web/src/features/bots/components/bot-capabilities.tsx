"use client";

import { ZapIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MAX_PARALLEL_TOOLS } from "@/features/bots/domains";
import { type Capabilities, one } from "./capabilities";
import { SubagentsSetting } from "./subagents-setting";

export type { Capabilities } from "./capabilities";

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

      <SubagentsSetting value={value} onChange={onChange} />
    </fieldset>
  );
}
