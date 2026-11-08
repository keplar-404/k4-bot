"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Block, BlockBody } from "../blocks";
import { Field, SettingsSection } from "./field";

type HttpBlock = Extract<BlockBody, { kind: "action.http" }>;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function HttpSettings({
  block,
  update,
}: {
  block: HttpBlock;
  update: (b: HttpBlock) => void;
}) {
  const set = (patch: Partial<HttpBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  return (
    <SettingsSection title="HTTP request">
      <Field id="http-method" label="Method">
        <select
          id="http-method"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={block.config.method}
          onChange={(e) =>
            set({ method: e.target.value as HttpBlock["config"]["method"] })
          }
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>
      <Field id="http-url" label="URL">
        <Input
          id="http-url"
          value={block.config.url}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
        />
      </Field>
      <Field id="http-timeout" label="Timeout (seconds)">
        <Input
          id="http-timeout"
          type="number"
          min={1}
          max={30}
          value={block.config.timeoutSeconds}
          onChange={(e) =>
            set({
              timeoutSeconds: Math.max(
                1,
                Math.min(30, Number.parseInt(e.target.value, 10) || 15),
              ),
            })
          }
        />
      </Field>
      <Field id="http-expect" label="Expect">
        <select
          id="http-expect"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={block.config.expect}
          onChange={(e) => set({ expect: e.target.value as "json" | "text" })}
        >
          <option value="json">JSON</option>
          <option value="text">Text</option>
        </select>
      </Field>
      <SettingsSection title="Headers">
        {block.config.headers.map((h, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: header rows have no id and are only edited in place
            key={i}
            className="grid grid-cols-[1fr_1.6fr_auto] items-center gap-2"
          >
            <Input
              aria-label="Header name"
              placeholder="Authorization"
              value={h.name}
              onChange={(e) => {
                const next = [...block.config.headers];
                next[i] = { ...h, name: e.target.value };
                set({ headers: next });
              }}
            />
            <Input
              aria-label="Header value"
              placeholder="Bearer {{secrets.TOKEN}}"
              value={h.value}
              onChange={(e) => {
                const next = [...block.config.headers];
                next[i] = { ...h, value: e.target.value };
                set({ headers: next });
              }}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove header"
              onClick={() =>
                set({ headers: block.config.headers.filter((_, j) => j !== i) })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        {block.config.headers.length < 10 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set({
                headers: [...block.config.headers, { name: "", value: "" }],
              })
            }
          >
            <PlusIcon />
            Add header
          </Button>
        )}
      </SettingsSection>
      <SettingsSection title="Body">
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={block.config.body.type}
          onChange={(e) =>
            set({
              body: {
                ...block.config.body,
                type: e.target.value as "none" | "json" | "text" | "form",
              },
            })
          }
        >
          <option value="none">None</option>
          <option value="json">JSON</option>
          <option value="text">Text</option>
          <option value="form">Form</option>
        </select>
        {block.config.body.type !== "none" && (
          <Textarea
            className="font-mono text-xs"
            rows={3}
            value={block.config.body.value}
            onChange={(e) =>
              set({ body: { ...block.config.body, value: e.target.value } })
            }
            placeholder='{"key": "{{trigger.body.value}}"}'
          />
        )}
      </SettingsSection>
    </SettingsSection>
  );
}
