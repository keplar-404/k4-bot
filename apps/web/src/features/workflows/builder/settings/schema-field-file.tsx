"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilePickerDialog } from "@/features/files/components/file-picker-dialog";
import { Field } from "./field";
import { FileChips, type FileRef } from "./file-chips";

const asRefs = (v: unknown): FileRef[] =>
  (Array.isArray(v) ? v : [v]).filter(
    (x): x is FileRef => typeof (x as FileRef)?.$file === "string",
  );

/**
 * A file input of an app action (an email attachment, a Slack upload): pick from the Files page, or use a file from an
 * earlier step with a {{reference}}. The file is uploaded to the app when the block runs.
 */
export function SchemaFieldFile({
  id,
  label,
  required,
  hint,
  meta,
  multiple,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required: boolean;
  hint: string | undefined;
  meta?: string;
  multiple: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [picking, setPicking] = useState(false);
  const refs = asRefs(value);
  const reference = typeof value === "string";
  return (
    <Field id={id} label={label} required={required} meta={meta} hint={hint}>
      {reference ? (
        <Input
          id={id}
          className="font-mono text-xs"
          value={value}
          placeholder="{{steps.….output.file}}"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      ) : (
        <FileChips
          refs={refs}
          onRemove={(fileId) => {
            const rest = refs.filter((x) => x.$file !== fileId);
            onChange(multiple && rest.length ? rest : undefined);
          }}
        />
      )}
      <div className="flex gap-1.5">
        <Button
          id={reference ? undefined : id}
          size="xs"
          variant="outline"
          onClick={() => setPicking(true)}
        >
          {refs.length ? "Change file" : "Choose a file"}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onChange(reference ? undefined : "")}
        >
          {reference ? "Pick a file instead" : "Use data from a step"}
        </Button>
      </div>
      <FilePickerDialog
        open={picking}
        onOpenChange={setPicking}
        max={multiple ? 10 : 1}
        picked={refs.map((r) => r.$file)}
        title={`Choose ${multiple ? "files" : "a file"} for ${label}`}
        onPick={(files) => {
          const picked = files.map((f) => ({ $file: f.id, name: f.name }));
          onChange(
            picked.length === 0 ? undefined : multiple ? picked : picked[0],
          );
        }}
      />
    </Field>
  );
}
