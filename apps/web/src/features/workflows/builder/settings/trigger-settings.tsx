"use client";

import type { Block, BlockBody } from "../blocks";
import { useBuilder } from "../store";
import { SettingsSection } from "./field";
import { ScheduleSettings } from "./schedule-settings";

type TriggerBlock = Extract<BlockBody, { kind: `trigger.${string}` }>;

/** What starts the workflow. A schedule runs at most every 5 minutes; a webhook gets its secret URL when turned on. */
export function TriggerSettings({
  block,
  update,
}: {
  block: TriggerBlock;
  update: (b: TriggerBlock) => void;
}) {
  const hasWebhook = useBuilder((s) => s.workflow?.hasWebhook ?? false);
  if (block.kind === "trigger.manual") {
    return (
      <SettingsSection title="Runs when">
        <p className="text-muted-foreground text-sm">
          You press Run in the top bar. Use it to try a workflow, or for jobs
          you start yourself.
        </p>
      </SettingsSection>
    );
  }
  if (block.kind === "trigger.webhook") {
    return (
      <SettingsSection title="Runs when">
        <p className="text-muted-foreground text-sm">
          Another service sends a POST request to this workflow&apos;s secret
          URL. The JSON body is available to every step as{" "}
          <code className="rounded bg-muted px-1 text-xs">
            {"{{trigger.body}}"}
          </code>
          .
        </p>
        <p className="text-muted-foreground text-sm">
          {hasWebhook
            ? "The URL was shown when you turned the workflow on. Use “New webhook URL” in the menu if it leaked."
            : "The URL is created when you turn the workflow on, and shown once."}
        </p>
      </SettingsSection>
    );
  }
  return <ScheduleSettings block={block} update={update} />;
}
