"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";
import { SecretPicker } from "./webhook/secret-picker";

type Auth = Extract<BlockBody, { kind: "action.http" }>["config"]["auth"];

const TYPES: Record<Auth["type"], string> = {
  none: "No sign-in (public API)",
  bearer: "Token (Authorization: Bearer …)",
  basic: "Username and password",
  api_key: "API key in a header (e.g. x-api-key)",
};
const SECRET_REF = /^\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}$/;

/** How the HTTP block signs in: a preset that takes its token from the Secrets vault (never typed in the block). */
export function HttpAuth({
  auth,
  onChange,
}: {
  auth: Auth;
  onChange: (auth: Auth) => void;
}) {
  const set = (patch: Partial<Auth>) => onChange({ ...auth, ...patch });
  const secret = SECRET_REF.exec(auth.token)?.[1];
  return (
    <SettingsSection title="Sign in">
      <Field
        id="http-auth"
        label="How the API signs you in"
        hint="The API’s docs say which one; most use a token or an API key. The key itself is kept on the Secrets page."
      >
        <Select
          value={auth.type}
          onValueChange={(v) => v && set({ type: v as Auth["type"] })}
        >
          <SelectTrigger id="http-auth" className="w-full">
            <SelectValue>{TYPES[auth.type]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPES).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {auth.type === "basic" && (
        <Field
          id="http-user"
          label="Username"
          hint="Your account name or email for this service (the password comes from Secrets below)."
        >
          <TemplateInput
            placeholder={"e.g. api_user or {{secrets.API_USER}}"}
            id="http-user"
            value={auth.username}
            onChange={(username) => set({ username })}
          />
        </Field>
      )}
      {auth.type === "api_key" && (
        <Field
          id="http-key-header"
          label="Header name"
          hint="The header name from the API’s docs, e.g. x-api-key or X-Auth-Token."
        >
          <Input
            id="http-key-header"
            value={auth.headerName}
            maxLength={64}
            placeholder="x-api-key"
            onChange={(e) =>
              set({ headerName: e.target.value.replace(/[^A-Za-z0-9-]/g, "") })
            }
          />
        </Field>
      )}
      {auth.type !== "none" && (
        <SecretPicker
          value={secret}
          onChange={(name) => set({ token: `{{secrets.${name}}}` })}
          hint={
            auth.type === "basic"
              ? "The password, from the Secrets page."
              : "The token or key, from the Secrets page. It is never shown or stored in the run."
          }
        />
      )}
    </SettingsSection>
  );
}
