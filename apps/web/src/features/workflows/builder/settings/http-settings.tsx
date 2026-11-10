"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";
import { HttpAuth } from "./http-auth";
import { HttpHeaders } from "./http-headers";
import { HttpPagination } from "./http-pagination";

type HttpBlock = Extract<BlockBody, { kind: "action.http" }>;
type Config = HttpBlock["config"];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const EXPECT: Record<Config["expect"], string> = {
  json: "JSON (most APIs)",
  text: "Text",
};
const BODY: Record<Config["body"]["type"], string> = {
  none: "No body (usual for GET and DELETE)",
  json: "JSON (most APIs)",
  text: "Plain text",
  form: "Form (key=value&key2=value2)",
};
const BODY_PLACEHOLDER: Record<Config["body"]["type"], string> = {
  none: "",
  json: '{"email": "[pick with +]", "plan": "pro"}',
  text: "The text to send",
  form: "email=[pick with +]&plan=pro",
};

/** A shadcn Select over a fixed set of labelled options. */
function OptionSelect<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue>{options[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(options) as Array<[T, string]>).map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The HTTP request block: where to send it, how to sign in, what to send, and how to read the answer. */
export function HttpSettings({
  block,
  update,
}: {
  block: HttpBlock;
  update: (b: HttpBlock) => void;
}) {
  const c = block.config;
  const set = (patch: Partial<Config>) =>
    update({ ...block, config: { ...c, ...patch } });
  return (
    <>
      <SettingsSection title="Request">
        <Field
          id="http-method"
          label="Method"
          hint="Use what the API’s docs say for this endpoint: GET reads, POST creates, PUT or PATCH updates, DELETE removes."
        >
          <ToggleGroup
            id="http-method"
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            value={[c.method]}
            onValueChange={(v) =>
              v[0] && set({ method: v[0] as Config["method"] })
            }
          >
            {METHODS.map((m) => (
              <ToggleGroupItem
                key={m}
                value={m}
                className="flex-1 font-mono text-[11px]"
              >
                {m}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field
          id="http-url"
          label="URL"
          hint="The full address from the API’s docs, starting with https://. Add data from earlier steps with +, e.g. …/customers/[customer id]."
        >
          <TemplateInput
            id="http-url"
            value={c.url}
            onChange={(url) => set({ url })}
            placeholder="https://api.stripe.com/v1/customers"
          />
        </Field>
      </SettingsSection>

      <HttpHeaders
        kind="query"
        headers={c.query}
        onChange={(query) => set({ query })}
      />
      <HttpAuth auth={c.auth} onChange={(auth) => set({ auth })} />
      <HttpHeaders
        headers={c.headers}
        onChange={(headers) => set({ headers })}
      />

      <SettingsSection title="Body">
        <Field
          id="http-body-type"
          label="Send"
          hint={
            c.body.type === "none"
              ? undefined
              : "What the API’s docs say to send. Put data from earlier steps in it with + (in JSON, a text value goes between quotes)."
          }
        >
          <OptionSelect
            id="http-body-type"
            value={c.body.type}
            options={BODY}
            onChange={(type) => set({ body: { ...c.body, type } })}
          />
        </Field>
        {c.body.type !== "none" && (
          <TemplateInput
            multiline
            className="font-mono text-xs"
            aria-label="Body"
            value={c.body.value}
            onChange={(value) => set({ body: { ...c.body, value } })}
            placeholder={BODY_PLACEHOLDER[c.body.type]}
          />
        )}
      </SettingsSection>

      <SettingsSection title="Response">
        <div className="grid grid-cols-2 gap-3">
          <Field id="http-expect" label="The answer is">
            <OptionSelect
              id="http-expect"
              value={c.expect}
              options={EXPECT}
              onChange={(expect) => set({ expect })}
            />
          </Field>
          <Field id="http-timeout" label="Give up after (s)">
            <Input
              id="http-timeout"
              type="number"
              min={1}
              max={30}
              value={c.timeoutSeconds}
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
        </div>
        <p className="text-muted-foreground text-xs">
          Most APIs answer in JSON, so later blocks can pick its fields. If the
          service has not answered within the time (1 to 30 s), this try fails.
        </p>
      </SettingsSection>
      <HttpPagination
        value={c.pagination}
        onChange={(pagination) => set({ pagination })}
      />
    </>
  );
}
