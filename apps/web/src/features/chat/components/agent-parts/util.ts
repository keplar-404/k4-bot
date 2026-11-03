import type { ReactNode } from "react";
import type { MessagePart } from "@/features/chat/lib/protocol";

export function parse(input: string): Record<string, unknown> {
  try {
    const value = JSON.parse(input);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max = 80) => {
  const s = typeof v === "string" ? v : "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

/** "example.com" from a URL (or the first of a list), for one-line titles. */
export const hostOf = (value: unknown) => {
  const url = Array.isArray(value) ? value[0] : value;
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return "a page";
  }
};

export type ToolPart = Extract<MessagePart, { type: "tool" }>;

export type ToolDesc = { icon: ReactNode; title: string };

export type DescribeFn = (part: ToolPart, done: boolean) => ToolDesc | null;
