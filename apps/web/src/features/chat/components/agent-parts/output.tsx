"use client";

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
} from "@/components/ui/code-block";

export function Output({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <CodeBlock size="sm">
        <CodeBlockContent wrap className="max-h-64">
          {text.split("\n").map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
            <CodeBlockLine key={i}>{line || " "}</CodeBlockLine>
          ))}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  );
}
