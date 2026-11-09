"use client";

import { Button } from "@/components/ui/button";
import type { BlockBody } from "../blocks";
import { useBuilder } from "../store";
import { usePublish } from "../use-publish";
import { SettingsSection } from "./field";
import { ScheduleSettings } from "./schedule-settings";

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
  const hasWebhook = useBuilder((s) => s.workflow?.hasWebhook ?? false);
  const pub = usePublish();
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
            ? "The URL was shown once, when you turned the workflow on. Lost it, or it leaked? Make a new one: the old one stops working."
            : "Turn the workflow on to get its URL. It is shown once: copy it into the other service."}
        </p>
        {hasWebhook && (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            disabled={pub.busy}
            onClick={() => void pub.newWebhookUrl()}
          >
            New webhook URL
          </Button>
        )}
      </SettingsSection>
    );
  }
  return <ScheduleSettings block={block} update={update} />;
}
