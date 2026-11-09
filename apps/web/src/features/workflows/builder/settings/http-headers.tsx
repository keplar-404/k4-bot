"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TemplateInput } from "../template/template-input";
import { SettingsSection } from "./field";

type Header = { name: string; value: string };

/** What a name/value list is for: its title, row placeholders and button text. */
const KINDS = {
  header: {
    title: "Headers",
    name: "Authorization",
    value: "Bearer {{secrets.TOKEN}}",
    add: "Add header",
    max: 10,
    what: "header",
  },
  input: {
    title: "Input",
    name: "items",
    value: "{{steps.x.output.rows}}",
    add: "Add input",
    max: 20,
    what: "input",
  },
  query: {
    title: "Query parameters",
    name: "page",
    value: "{{steps.x.output.page}}",
    add: "Add parameter",
    max: 20,
    what: "parameter",
  },
} as const;

/**
 * The HTTP block's request headers (or query parameters, `kind="query"`): a name, and a value that may hold data
 * from earlier steps or a secret.
 */
export function HttpHeaders({
  headers,
  onChange,
  kind = "header",
}: {
  headers: Header[];
  onChange: (headers: Header[]) => void;
  kind?: keyof typeof KINDS;
}) {
  const k = KINDS[kind];
  return (
    <SettingsSection title={k.title}>
      {headers.map((h, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: header rows have no id and are only edited in place
          key={i}
          className="grid grid-cols-[1fr_1.6fr_auto] items-center gap-2"
        >
          <Input
            aria-label={`${k.what} name`}
            placeholder={k.name}
            value={h.name}
            onChange={(e) => {
              const next = [...headers];
              next[i] = { ...h, name: e.target.value };
              onChange(next);
            }}
          />
          <TemplateInput
            aria-label={`${k.what} value`}
            placeholder={k.value}
            value={h.value}
            onChange={(value) => {
              const next = [...headers];
              next[i] = { ...h, value };
              onChange(next);
            }}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${k.what}`}
            onClick={() => onChange(headers.filter((_, j) => j !== i))}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      {headers.length < k.max && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange([...headers, { name: "", value: "" }])}
        >
          <PlusIcon />
          {k.add}
        </Button>
      )}
    </SettingsSection>
  );
}
