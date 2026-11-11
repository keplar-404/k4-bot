"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockBody } from "../blocks";

type AnswerField = Extract<
  BlockBody,
  { kind: "ai.bot" }
>["config"]["schema"][number];

const TYPES: Record<AnswerField["type"], string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / no",
  list: "List of text",
  enum: "One of…",
};

/** Examples for the first rows, so the form shows what a good field looks like. */
const EXAMPLES = [
  { name: "urgent", description: "true if the sender needs an answer today" },
  { name: "reply", description: "a short, friendly reply to the email" },
  { name: "team", description: "which team should handle it" },
];

/**
 * The answer's shape: one row per field the bot must return. The model is forced into exactly these fields, and the
 * next blocks read them as {{steps.<id>.output.json.<name>}} (the data picker lists them at once).
 */
export function AiOutputFields({
  blockId,
  fields,
  onChange,
}: {
  blockId: string;
  fields: AnswerField[];
  onChange: (fields: AnswerField[]) => void;
}) {
  const edit = (i: number, patch: Partial<AnswerField>) =>
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const add = () =>
    onChange([
      ...fields,
      { name: "", type: "text", description: "", choices: [] },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {fields.map((f, i) => {
        const example = EXAMPLES[i % EXAMPLES.length] ?? EXAMPLES[0];
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id; order is the identity
            key={i}
            className="flex flex-col gap-2 rounded-lg border p-2.5"
          >
            <div className="flex gap-2">
              <Input
                aria-label="Field name"
                className="h-8 flex-1 font-mono text-xs"
                value={f.name}
                placeholder={`e.g. ${example.name}`}
                maxLength={40}
                onChange={(e) =>
                  edit(i, {
                    name: e.target.value.replace(/[^A-Za-z0-9_]/g, ""),
                  })
                }
              />
              <Select
                value={f.type}
                onValueChange={(v) =>
                  edit(i, { type: v as AnswerField["type"] })
                }
              >
                <SelectTrigger aria-label="Field type" className="h-8 w-32">
                  <SelectValue>{TYPES[f.type]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${f.name || "field"}`}
                onClick={() => onChange(fields.filter((_, j) => j !== i))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <Input
              aria-label="What it means"
              className="h-8 text-xs"
              value={f.description}
              placeholder={`e.g. ${example.description}`}
              maxLength={300}
              onChange={(e) => edit(i, { description: e.target.value })}
            />
            {f.type === "enum" && (
              <Input
                aria-label="Choices"
                className="h-8 text-xs"
                value={f.choices.join(", ")}
                placeholder="e.g. sales, support, spam"
                onChange={(e) =>
                  edit(i, {
                    choices: e.target.value
                      .split(",")
                      .map((c) => c.trimStart())
                      .slice(0, 20),
                  })
                }
              />
            )}
            {f.name && (
              <code className="break-all rounded bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">
                {`{{steps.${blockId}.output.json.${f.name}}}`}
              </code>
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        onClick={add}
        disabled={fields.length >= 20}
      >
        <PlusIcon />
        Add answer field
      </Button>
    </div>
  );
}
