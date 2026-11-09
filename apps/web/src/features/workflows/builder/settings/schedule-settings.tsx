"use client";

import { ScheduleEditor } from "@/features/schedules/schedule-editor";
import type { BlockBody } from "../blocks";
import { SettingsSection } from "./field";

type SchedBlock = Extract<BlockBody, { kind: "trigger.schedule" }>;

/** Schedule trigger: once, daily, weekly, monthly, or every few minutes (5 at least), in the chosen time zone. */
export function ScheduleSettings({
  block,
  update,
}: {
  block: SchedBlock;
  update: (b: SchedBlock) => void;
}) {
  return (
    <SettingsSection title="Runs">
      <ScheduleEditor
        value={block.config}
        onChange={(config) => update({ ...block, config })}
      />
      <p className="text-muted-foreground text-xs">
        {block.config.mode === "every"
          ? "The first run is one interval after you turn the workflow on."
          : block.config.mode === "once"
            ? "It runs once, then turns itself off."
            : "Times are in the time zone above, so 09:00 stays 09:00 when the clocks change."}
      </p>
    </SettingsSection>
  );
}
