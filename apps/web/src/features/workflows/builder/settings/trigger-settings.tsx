"use client";

import type { BlockBody } from "../blocks";
import { SettingsSection } from "./field";
import { ManualFormSettings } from "./manual-form-settings";
import { ScheduleSettings } from "./schedule-settings";
import { WebhookSettings } from "./webhook/webhook-settings";

type TriggerBlock = Extract<
  BlockBody,
  { kind: "trigger.manual" | "trigger.schedule" | "trigger.webhook" }
>;

/** What starts the workflow. A schedule runs at most every 5 minutes; a webhook gets its secret URL when turned on. */
export function TriggerSettings({
  block,
  update,
}: {
  block: TriggerBlock;
  update: (b: TriggerBlock) => void;
}) {
  if (block.kind === "trigger.manual") {
    return (
      <>
        <SettingsSection title="Runs when">
          <p className="text-muted-foreground text-sm">
            You press Run in the top bar, or a bot runs it. Use it to try a
            workflow, or for jobs you start yourself.
          </p>
        </SettingsSection>
        <ManualFormSettings block={block} update={update} />
      </>
    );
  }
  if (block.kind === "trigger.webhook") {
    return <WebhookSettings block={block} update={update} />;
  }
  return <ScheduleSettings block={block} update={update} />;
}
