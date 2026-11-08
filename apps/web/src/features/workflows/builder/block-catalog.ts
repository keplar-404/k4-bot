import {
  ClockIcon,
  FilterIcon,
  GitBranchIcon,
  GlobeIcon,
  HandIcon,
  HourglassIcon,
  type LucideIcon,
  PencilLineIcon,
  WebhookIcon,
} from "lucide-react";
import type { BlockKind } from "./blocks";

export type BlockInfo = {
  kind: BlockKind;
  title: string;
  hint: string;
  icon: LucideIcon;
  group: "Triggers" | "Logic";
};

/** The built-in blocks the library offers (apps are listed from the catalog). */
export const BUILT_IN: BlockInfo[] = [
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
    hint: "Every few minutes, hours or days",
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
    kind: "logic.if",
    title: "If / else",
    hint: "Take one of two paths",
    icon: GitBranchIcon,
    group: "Logic",
  },
  {
    kind: "logic.filter",
    title: "Filter",
    hint: "Continue only when it matches",
    icon: FilterIcon,
    group: "Logic",
  },
  {
    kind: "logic.delay",
    title: "Delay",
    hint: "Wait before the next step",
    icon: HourglassIcon,
    group: "Logic",
  },
  {
    kind: "logic.set",
    title: "Set fields",
    hint: "Shape data for later steps",
    icon: PencilLineIcon,
    group: "Logic",
  },
  {
    kind: "action.http",
    title: "HTTP request",
    hint: "Call any API or website",
    icon: GlobeIcon,
    group: "Logic",
  },
];

export const infoOf = (kind: BlockKind) =>
  BUILT_IN.find((b) => b.kind === kind);
