"use client";

import { Button } from "@/components/ui/button";
import type { BlockBody } from "../../blocks";
import { useBuilder } from "../../store";
import { usePublish } from "../../use-publish";
import { SettingsSection } from "../field";
import { WebhookAuth } from "./webhook-auth";
import { WebhookRequests } from "./webhook-requests";
import { WebhookSamples } from "./webhook-samples";

type WebhookBlock = Extract<BlockBody, { kind: "trigger.webhook" }>;

/**
 * Webhook trigger: what it is, who may call it (URL token always; plus a header secret or an HMAC signature, and an IP
 * allowlist), how to call it, and the latest calls. Every call is rate limited (60 runs a minute per workflow, and per
 * sender IP) and capped at 256 KB of JSON.
 */
export function WebhookSettings({
  block,
  update,
}: {
  block: WebhookBlock;
  update: (b: WebhookBlock) => void;
}) {
  const workflowId = useBuilder((s) => s.workflow?.id ?? "");
  const hasWebhook = useBuilder((s) => s.workflow?.hasWebhook ?? false);
  const pub = usePublish();
  return (
    <>
      <SettingsSection title="Runs when">
        <p className="text-muted-foreground text-sm">
          Another service sends a POST request with a JSON body to this
          workflow&apos;s secret URL. Every step can read the body, e.g.{" "}
          <code className="rounded bg-muted px-1 text-xs">
            {"{{trigger.body.email}}"}
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
      <SettingsSection title="Who may call it">
        <WebhookAuth
          config={block.config}
          onChange={(config) => update({ ...block, config })}
        />
      </SettingsSection>
      <SettingsSection title="How to call it">
        <WebhookSamples config={block.config} />
      </SettingsSection>
      {hasWebhook && workflowId && (
        <SettingsSection title="Latest calls">
          <WebhookRequests workflowId={workflowId} />
        </SettingsSection>
      )}
    </>
  );
}
