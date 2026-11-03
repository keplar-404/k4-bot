"use client";

import { useIsCodeFenceIncomplete } from "streamdown";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";

/** A fenced code block of a reply: highlighted, with Copy once the fence is closed. */
export function MarkdownCodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  // True until the closing fence arrives, so Copy is not offered half-way.
  const incomplete = useIsCodeFenceIncomplete();
  const lines = useHighlightedCode(code, language);

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>{language || "text"}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} disabled={incomplete} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          // Lines are append-only while streaming, so the index is a stable key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}
