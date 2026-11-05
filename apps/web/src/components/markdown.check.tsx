import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

const html = (text: string, isStreaming = false) =>
  renderToStaticMarkup(<Markdown isStreaming={isStreaming}>{text}</Markdown>);

// Bold is rendered as bold; the asterisks never reach the page.
const bold = html("This is **some bold text** here.");
assert.match(bold, /data-streamdown="strong">some bold text<\/span>/);
assert.ok(!bold.includes("**"), "raw ** must not be shown");

// A reply cut off mid-stream must not flash raw markup either.
const partial = html("This is **half-written bold", true);
assert.match(partial, /data-streamdown="strong">half-written bold<\/span>/);
assert.ok(
  !partial.includes("**"),
  "an unclosed ** must not be shown while streaming",
);

// Headings and lists.
const structure = html("## Title\n\n- one\n- two\n\n1. first\n2. second");
assert.match(structure, /data-streamdown="heading-2">Title<\/h2>/);
assert.equal((structure.match(/data-streamdown="list-item"/g) ?? []).length, 4);

// Inline code stays inline; a fence becomes a CodeBlock with a copy button.
assert.match(
  html("Use `useState` here."),
  /<code[^>]*class="[^"]*bg-muted[^"]*"[^>]*>useState<\/code>/,
);
const fenced = html("```ts\nconst a = 1;\n```");
assert.ok(
  fenced.includes('data-slot="code-block"'),
  "a fence should render as a CodeBlock",
);
assert.ok(fenced.includes('data-slot="code-block-copy-button"'));
assert.ok(!fenced.includes("```"), "raw fence markers must not be shown");

// Links (Streamdown asks before leaving the app) and tables.
assert.match(
  html("[docs](https://example.com)"),
  /data-streamdown="link"[^>]*>docs<\/button>/,
);
// A deep-research citation is a small pill showing the number, still behind the same link check.
const cited = html("Value fell [[3]](https://example.com/a).");
assert.match(
  cited,
  /data-streamdown="link"[^>]*>3<\/button>/,
  "pill shows the number",
);
assert.match(cited, /class="[^"]*rounded-full[^"]*"/, "styled as a pill");
assert.ok(!cited.includes("[3]"), "no raw brackets");
assert.match(
  html("| a | b |\n|---|---|\n| 1 | 2 |"),
  /data-streamdown="table"/,
);

console.log("markdown: all checks passed");
