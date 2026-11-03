"use client";

import { WrenchIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { describeComputer } from "./describe-computer";
import { describeFiles } from "./describe-files";
import { describeOther } from "./describe-other";
import { describeSubagents } from "./describe-subagents";
import { describeWeb } from "./describe-web";
import type { ToolPart } from "./util";
import { parse, type ToolDesc } from "./util";

type ToolPartT = Extract<MessagePart, { type: "tool" }>;

export function describe(
  part: ToolPartT,
  done: boolean,
): { icon: ReactNode; title: string } {
  const r =
    describeComputer(part, done) ??
    describeWeb(part, done) ??
    describeSubagents(part, done) ??
    describeFiles(part, done) ??
    describeOther(part, done);
  if (r) return r;
  return {
    icon: <WrenchIcon />,
    title: `${done ? "Used" : "Using"} ${part.name}`,
  };
}

export { parse };
