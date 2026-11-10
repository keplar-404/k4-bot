"use client";

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { cn } from "cn";
import { useEffect, useRef } from "react";
import { REF_DRAG_TYPE } from "./block-fields";
import { DataPickerButton } from "./data-picker-button";
import { RefNode } from "./ref-node";
import { docToTemplate, templateToDoc } from "./template-text";

/**
 * A text field that can hold data from earlier steps. References show as pills ("Gmail · subject"); add one by
 * dragging a field from the Data tab, with the "+" button, or by typing {{path}}. The value stays the template string
 * the engine fills in, so nothing about storage or runs changes.
 */
export function TemplateInput({
  id,
  value,
  onChange,
  placeholder,
  multiline = false,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const emitted = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      RefNode,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: templateToDoc(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        role: "textbox",
        "aria-multiline": String(multiline),
        class: cn(
          "min-w-0 flex-1 px-3 py-1.5 outline-none",
          multiline ? "min-h-20" : "min-h-9 leading-6",
        ),
      },
      // A one-line field never gets a second line.
      handleKeyDown: (_view, event) => !multiline && event.key === "Enter",
      handleDrop: (view, event) => {
        const path = event.dataTransfer?.getData(REF_DRAG_TYPE);
        if (!path) return false;
        const at = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (!at) return false;
        event.preventDefault();
        const node = view.state.schema.nodes.dataRef!.create({ path });
        view.dispatch(view.state.tr.insert(at.pos, node));
        view.focus();
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      emitted.current = docToTemplate(e.getJSON());
      onChange(emitted.current);
    },
    // References typed by hand ({{trigger.data.x}}) become pills when the field loses focus.
    onBlur: ({ editor: e }) => {
      const text = docToTemplate(e.getJSON());
      if (
        /\{\{[^}]+\}\}/.test(text) &&
        JSON.stringify(templateToDoc(text)) !== JSON.stringify(e.getJSON())
      ) {
        e.commands.setContent(templateToDoc(text), { emitUpdate: false });
      }
    },
  });

  // A value changed from outside (another block selected, an undo, a bot's edit) replaces the content.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(templateToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start rounded-md border border-input bg-transparent text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
        multiline ? "min-h-20" : "min-h-9",
        className,
      )}
    >
      <EditorContent
        editor={editor}
        className="flex min-w-0 flex-1 [&_.ProseMirror]:break-words"
      />
      <DataPickerButton
        onPick={(path) =>
          editor
            ?.chain()
            .focus()
            .insertContent({ type: "dataRef", attrs: { path } })
            .run()
        }
      />
    </div>
  );
}
