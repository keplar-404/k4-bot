"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlockBody } from "../blocks";
import { Field, SettingsSection } from "./field";
import { HttpHeaders } from "./http-headers";

type CodeBlock = Extract<BlockBody, { kind: "action.code" }>;

/** Code: JavaScript run in a fresh sandbox, with named inputs from earlier steps, stopped after the time limit. */
export function CodeSettings({ block, update }: { block: CodeBlock; update: (b: CodeBlock) => void }) {
  const set = (patch: Partial<CodeBlock["config"]>) => update({ ...block, config: { ...block.config, ...patch } });
  return (
    <>
      <HttpHeaders
        kind="input"
        headers={block.config.inputs.map((i) => ({ name: i.key, value: i.value }))}
        onChange={(rows) => set({ inputs: rows.map((r) => ({ key: r.name.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 41), value: r.value })) })}
      />
      <SettingsSection title="JavaScript">
        <Field
          id="code-body"
          label="Code"
          required
          hint="The body of an async function: read input.<name>, use await, console.log for notes, and return the result. Node.js, no secrets. Read it later as {{steps.<id>.output.result}}."
        >
          <Textarea
            id="code-body"
            spellCheck={false}
            className="min-h-48 font-mono text-xs"
            value={block.config.code}
            maxLength={20_000}
            onChange={(e) => set({ code: e.target.value })}
          />
        </Field>
        <Field
          id="code-timeout"
          label="Stop after (seconds)"
          hint="It runs in a new sandbox each time and is stopped at this limit. The seconds it runs count toward your daily sandbox time."
        >
          <Input
            id="code-timeout"
            type="number"
            min={1}
            max={120}
            value={block.config.timeoutSeconds}
            onChange={(e) => set({ timeoutSeconds: Math.min(120, Math.max(1, Number.parseInt(e.target.value, 10) || 1)) })}
          />
        </Field>
      </SettingsSection>
    </>
  );
}
