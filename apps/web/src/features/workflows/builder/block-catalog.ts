import {
  CodeIcon,
  CornerDownLeftIcon,
  FilterIcon,
  GitBranchIcon,
  GlobeIcon,
  HourglassIcon,
  ListIcon,
  type LucideIcon,
  MergeIcon,
  PencilLineIcon,
  RepeatIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SplitIcon,
  WandIcon,
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
    kind: "logic.switch",
    title: "Switch",
    hint: "Take one of several paths by rules",
    icon: SplitIcon,
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
    kind: "logic.format",
    title: "Formatter",
    hint: "Change text, numbers, dates or lists",
    icon: WandIcon,
    group: "Logic",
  },
  {
    kind: "logic.merge",
    title: "Merge",
    hint: "Bring paths or values together",
    icon: MergeIcon,
    group: "Logic",
  },
  {
    kind: "logic.list",
    title: "List tools",
    hint: "Split out, pick, sum, sort or group a list",
    icon: ListIcon,
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
    kind: "logic.return",
    title: "Return",
    hint: "The workflow's answer: what a bot running it gets back",
    icon: CornerDownLeftIcon,
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
    kind: "ai.decide",
    title: "Decide (Jev)",
    hint: "Yes/no, pick one, or score: typed answers",
    icon: ScaleIcon,
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
  {
    kind: "action.code",
    title: "Code",
    hint: "Run JavaScript in a sandbox",
    icon: CodeIcon,
    group: "Logic",
  },
];

export const infoOf = (kind: BlockKind) =>
  BUILT_IN.find((b) => b.kind === kind);
