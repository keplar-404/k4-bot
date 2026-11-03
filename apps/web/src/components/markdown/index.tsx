"use client";

import type * as React from "react";
import { type ExtraProps, Streamdown } from "streamdown";
import { MarkdownCodeBlock } from "./code-block";

/**
 * shadcn AI Elements "Markdown" pattern: the reply is rendered with Streamdown
 * (built for streaming, so unfinished `**bold` or an open code fence never
 * flashes raw), and fenced code is routed to a CodeBlock.
 * https://ui.shadcn.com/docs/components/base/code-block#markdown
 */

function MarkdownCode({
  node: _node,
  className,
  children,
  ...props
}: React.ComponentProps<"code"> & ExtraProps) {
  // Streamdown marks fenced code with data-block; everything else is inline.
  if (!("data-block" in props)) {
    return (
      <code
        className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <MarkdownCodeBlock
      code={typeof children === "string" ? children : ""}
      language={/language-(\S+)/.exec(className ?? "")?.[1] ?? ""}
    />
  );
}

const components = { code: MarkdownCode };

export function Markdown({
  children,
  isStreaming = false,
}: {
  children: string;
  /** True while this reply is still arriving. */
  isStreaming?: boolean;
}) {
  return (
    <Streamdown
      controls={false}
      components={components}
      isAnimating={isStreaming}
    >
      {children}
    </Streamdown>
  );
}
