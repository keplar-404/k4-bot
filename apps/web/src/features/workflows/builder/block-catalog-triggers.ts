import { ClockIcon, HandIcon, WebhookIcon, ZapIcon } from "lucide-react";
import type { BlockInfo } from "./block-catalog";

/** The trigger blocks: what starts a workflow. */
export const TRIGGER_BLOCKS: BlockInfo[] = [
  {
    kind: "trigger.manual",
    title: "Manual",
    hint: "Run it yourself with a button",
    icon: HandIcon,
    group: "Triggers",
  },
  {
    kind: "trigger.schedule",
    title: "Schedule",
    hint: "At a time, daily, weekly or monthly",
    icon: ClockIcon,
    group: "Triggers",
  },
  {
    kind: "trigger.webhook",
    title: "Webhook",
    hint: "When another service calls a URL",
    icon: WebhookIcon,
    group: "Triggers",
  },
  {
    kind: "trigger.app",
    title: "App event",
    hint: "When something happens in an app",
    icon: ZapIcon,
    group: "Triggers",
  },
];
