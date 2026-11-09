"use client";

import { Input } from "@/components/ui/input";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";
import { HttpAuth } from "./http-auth";
import { HttpHeaders } from "./http-headers";
import { HttpPagination } from "./http-pagination";

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
        <TemplateInput
          id="http-url"
          value={block.config.url}
          onChange={(url) => set({ url })}
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
      <HttpHeaders
        kind="query"
        headers={block.config.query}
        onChange={(query) => set({ query })}
      />
      <HttpAuth auth={block.config.auth} onChange={(auth) => set({ auth })} />
      <HttpPagination
        value={block.config.pagination}
        onChange={(pagination) => set({ pagination })}
      />
      <HttpHeaders
        headers={block.config.headers}
        onChange={(headers) => set({ headers })}
      />
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
          <TemplateInput
            multiline
            className="font-mono text-xs"
            aria-label="Body"
            value={block.config.body.value}
            onChange={(value) => set({ body: { ...block.config.body, value } })}
            placeholder='{"key": "value"}'
          />
        )}
      </SettingsSection>
    </SettingsSection>
  );
}
