"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BlockBody } from "../blocks";
import { SettingsSection } from "./field";

type SetBlock = Extract<BlockBody, { kind: "logic.set" }>;

/** Set fields: name values for later steps (`{{steps.<this>.output.<name>}}`). */
export function SetFieldsSettings({
  block,
  update,
}: {
  block: SetBlock;
  update: (b: SetBlock) => void;
}) {
  const fields = block.config.fields;
  const set = (next: SetBlock["config"]["fields"]) =>
    update({ ...block, config: { fields: next } });
  return (
    <SettingsSection title="Fields">
      {fields.map((f, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are ordered and have no identity of their own
          key={i}
          className="grid grid-cols-[1fr_1.6fr_auto] items-center gap-2"
        >
          <Input
            aria-label="Field name"
            placeholder="name"
            value={f.key}
            onChange={(e) =>
              set(
                fields.map((x, j) =>
                  j === i
                    ? {
                        ...x,
                        key: e.target.value.replace(/[^A-Za-z0-9_]/g, ""),
                      }
                    : x,
                ),
              )
            }
          />
          <Input
            aria-label="Value"
            placeholder="{{trigger.body.name}}"
            value={f.value}
            onChange={(e) =>
              set(
                fields.map((x, j) =>
                  j === i ? { ...x, value: e.target.value } : x,
                ),
              )
            }
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${f.key || "field"}`}
            onClick={() => set(fields.filter((_, j) => j !== i))}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      {fields.length < 20 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            set([...fields, { key: `field${fields.length + 1}`, value: "" }])
          }
        >
          <PlusIcon />
          Add field
        </Button>
      )}
    </SettingsSection>
  );
}
