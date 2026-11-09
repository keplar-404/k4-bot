import {
  FilterIcon,
  GitBranchIcon,
  GlobeIcon,
  HourglassIcon,
  type LucideIcon,
  PencilLineIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { TRIGGER_BLOCKS } from "./block-catalog-triggers";
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
  ...TRIGGER_BLOCKS,
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
    kind: "logic.loop",
    title: "For each",
    hint: "Repeat the next steps for every item",
    icon: RepeatIcon,
    group: "Logic",
  },
  {
    kind: "logic.approval",
    title: "Ask me first",
    hint: "Wait until you approve",
    icon: ShieldCheckIcon,
    group: "Logic",
  },
  {
    kind: "ai.bot",
    title: "Ask a bot",
    hint: "A bot writes, sums up or decides",
    icon: SparklesIcon,
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
