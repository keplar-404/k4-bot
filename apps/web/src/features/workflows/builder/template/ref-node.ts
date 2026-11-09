import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { RefPill } from "./ref-pill";

/**
 * A reference to earlier data (`{{path}}`) as one unbreakable inline token: it is selected, deleted and dragged as a
 * whole, and shown as a pill. Copying it as text gives the `{{path}}` form back.
 */
export const RefNode = Node.create({
  name: "dataRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { path: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-ref]",
        getAttrs: (el) => ({ path: (el as HTMLElement).dataset.ref ?? "" }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-ref": node.attrs.path }),
      `{{${node.attrs.path}}}`,
    ];
  },
  renderText({ node }) {
    return `{{${node.attrs.path}}}`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(RefPill, { as: "span" });
  },
});
