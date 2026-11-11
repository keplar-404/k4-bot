"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BlockBody } from "../../blocks";
import { Field } from "../field";
import { SecretPicker } from "./secret-picker";

type Config = Extract<BlockBody, { kind: "trigger.webhook" }>["config"];
const AUTH: Array<[Config["auth"], string]> = [
  ["none", "Anyone with the URL"],
  ["header", "Must send a secret header"],
  ["hmac", "Must sign the body (HMAC-SHA256)"],
];

/** The webhook's checks: header secret or body signature (secret from the vault), and an optional IP allowlist. */
export function WebhookAuth({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  const set = (patch: Partial<Config>) => onChange({ ...config, ...patch });
  return (
    <>
      <Field
        id="hook-auth"
        label="Extra check (optional)"
        hint="The URL is secret either way. A header or signature means a leaked URL alone is not enough."
      >
        <Select
          value={config.auth}
          onValueChange={(v) => set({ auth: v as Config["auth"] })}
        >
          <SelectTrigger id="hook-auth" className="w-full">
            <SelectValue>
              {AUTH.find(([a]) => a === config.auth)?.[1]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AUTH.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {config.auth !== "none" && (
        <>
          <SecretPicker
            value={config.secretName}
            onChange={(secretName) => set({ secretName })}
          />
          {config.auth === "header" ? (
            <Field
              id="hook-header"
              label="Header name"
              hint="The header the sender puts the secret in, e.g. x-webhook-secret. Use the same name in the sending service."
            >
              <Input
                placeholder={"x-webhook-secret"}
                id="hook-header"
                value={config.headerName}
                maxLength={64}
                onChange={(e) => set({ headerName: e.target.value })}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <Field
                id="hook-sig"
                label="Signature header"
                hint="Where the sender puts its signature, from its docs (Stripe: Stripe-Signature, GitHub: X-Hub-Signature-256)."
              >
                <Input
                  placeholder={"x-hub-signature-256"}
                  id="hook-sig"
                  value={config.signatureHeader}
                  maxLength={64}
                  onChange={(e) => set({ signatureHeader: e.target.value })}
                />
              </Field>
              <Field
                id="hook-prefix"
                label="Text before the signature (optional)"
                hint="Some senders add one, e.g. GitHub sends sha256=… Leave empty if not."
              >
                <Input
                  placeholder={"sha256="}
                  id="hook-prefix"
                  value={config.signaturePrefix}
                  maxLength={20}
                  onChange={(e) => set({ signaturePrefix: e.target.value })}
                />
              </Field>
            </div>
          )}
        </>
      )}
      <Field
        id="hook-ips"
        label="Only from these IPs (optional)"
        hint="One address or IPv4 range per line, e.g. 203.0.113.0/24. Empty allows any sender."
      >
        <Textarea
          placeholder={"One per line, e.g.\n203.0.113.7\n198.51.100.0/24"}
          id="hook-ips"
          rows={2}
          className="font-mono text-xs"
          value={config.ipAllowlist.join("\n")}
          onChange={(e) =>
            set({
              ipAllowlist: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .slice(0, 20),
            })
          }
        />
      </Field>
    </>
  );
}
