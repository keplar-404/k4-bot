import type { JSONContent } from "@tiptap/core";

/** The reference syntax the engine fills in (same as the server's REFERENCE in engine/template.ts). */
const REFERENCE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/** One line of a template as editor nodes: plain text, with each {{path}} as a reference pill. */
function lineToNodes(line: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let last = 0;
  for (const match of line.matchAll(REFERENCE)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push({ type: "text", text: line.slice(last, at) });
    nodes.push({ type: "dataRef", attrs: { path: match[1] } });
    last = at + match[0].length;
  }
  if (last < line.length) nodes.push({ type: "text", text: line.slice(last) });
  return nodes;
}

/** A stored template string → the editor document (one paragraph per line). */
export function templateToDoc(value: string): JSONContent {
  return {
    type: "doc",
    content: value
      .split("\n")
      .map((line) => ({ type: "paragraph", content: lineToNodes(line) })),
  };
}

/** The editor document → the template string the workflow stores (paragraphs joined by newlines). */
export function docToTemplate(doc: JSONContent): string {
  return (doc.content ?? [])
    .map((paragraph) =>
      (paragraph.content ?? [])
        .map((node) =>
          node.type === "dataRef"
            ? `{{${node.attrs?.path ?? ""}}}`
            : (node.text ?? ""),
        )
        .join(""),
    )
    .join("\n");
}
