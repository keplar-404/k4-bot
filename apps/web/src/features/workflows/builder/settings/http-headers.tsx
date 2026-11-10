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
    name: "Content-Type",
    value: "application/json, or data with +",
    add: "Add header",
    max: 10,
    what: "header",
  },
  input: {
    title: "Input",
    name: "items",
    value: "A value, or data with +",
    add: "Add input",
    max: 20,
    what: "input",
  },
  query: {
    title: "Query parameters",
    name: "limit",
    value: "e.g. 50, or data with +",
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
      <div className="@container flex flex-col gap-3">
        {headers.map((h, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: header rows have no id and are only edited in place
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 border-l-2 pl-2.5 @md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] @md:border-l-0 @md:pl-0"
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
            <div className="col-span-2 row-start-2 min-w-0 @md:col-span-1 @md:row-start-auto">
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
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              className="col-start-2 row-start-1 text-muted-foreground hover:text-destructive @md:col-start-auto @md:row-start-auto"
              aria-label={`Remove ${k.what}`}
              onClick={() => onChange(headers.filter((_, j) => j !== i))}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>
      {headers.length < k.max && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-muted-foreground"
          onClick={() => onChange([...headers, { name: "", value: "" }])}
        >
          <PlusIcon />
          {k.add}
        </Button>
      )}
    </SettingsSection>
  );
}
