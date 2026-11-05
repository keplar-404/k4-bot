"use client";

import type * as React from "react";
import { defaultComponents, type ExtraProps, Streamdown } from "streamdown";
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

/** A citation like "[3]" (deep research links each one to its source). */
const CITATION = /^\[\d+\]$/;
const StreamdownLink = defaultComponents.a as React.ComponentType<
  React.ComponentProps<"a"> & ExtraProps
>;

/**
 * Citations read as small superscript pills ("3"); every other link is Streamdown's own. Both keep Streamdown's
 * link handling (it asks before leaving the app), only the look of a citation changes.
 */
function MarkdownLink(props: React.ComponentProps<"a"> & ExtraProps) {
  const { children } = props;
  const text =
    typeof children === "string"
      ? children
      : Array.isArray(children) &&
          children.length === 1 &&
          typeof children[0] === "string"
        ? children[0]
        : null;
  if (!text || !CITATION.test(text)) return <StreamdownLink {...props} />;
  return (
    <StreamdownLink
      {...props}
      className="relative -top-[0.4em] mx-px inline-flex h-[1.4em] min-w-[1.4em] items-center justify-center rounded-full bg-muted px-1 align-baseline font-medium text-[0.68em] text-muted-foreground no-underline tabular-nums transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      {text.slice(1, -1)}
    </StreamdownLink>
  );
}

const components = { code: MarkdownCode, a: MarkdownLink };

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
