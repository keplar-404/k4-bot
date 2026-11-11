"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { AiAppsNote } from "./ai-apps-note";
import { AiKnowledge } from "./ai-knowledge";
import { AiModelPicker } from "./ai-model-picker";
import { AiOutputFields } from "./ai-output-fields";
import { BotPicker } from "./bot-picker";
import { Field, SettingsSection } from "./field";

type AiBlock = Extract<BlockBody, { kind: "ai.bot" }>;
type Output = AiBlock["config"]["output"];

const OUTPUTS: Record<Output, string> = {
  text: "Text",
  structured: "Fields I choose",
  json: "Free JSON",
};

const OUTPUT_HINTS: Record<Output, string> = {
  text: "Read it with {{steps.<this block>.output.text}}.",
  structured:
    "The answer always has exactly these fields. Read each with {{steps.<this block>.output.json.<field>}}.",
  json: "Read fields with {{steps.<this block>.output.json.<field>}}. Say in the task which fields to return.",
};

/**
 * "Ask a bot": a model does this step. A normal bot is just the chosen model; one of the user's bots brings its
 * memory, persona and (read only) its apps and files. It cannot send, change or delete anything: put an app step
 * after it to act on its answer.
 */
export function AiSettings({
  block,
  update,
}: {
  block: AiBlock;
  update: (b: AiBlock) => void;
}) {
  const c = block.config;
  const set = (patch: Partial<AiBlock["config"]>) =>
    update({ ...block, config: { ...c, ...patch } });

  return (
    <>
      <SettingsSection title="Who does it">
        <ToggleGroup
          value={[c.agent]}
          onValueChange={(v: string[]) => {
            const agent = v[0] as AiBlock["config"]["agent"] | undefined;
            if (agent) set({ agent });
          }}
          variant="outline"
          className="w-full"
          aria-label="Who does it"
        >
          <ToggleGroupItem value="normal" className="flex-1">
            Normal bot
          </ToggleGroupItem>
          <ToggleGroupItem value="bot" className="flex-1">
            One of my bots
          </ToggleGroupItem>
        </ToggleGroup>
        {c.agent === "normal" ? (
          <AiModelPicker
            modelId={c.modelId}
            reasoningEffort={c.reasoningEffort}
            onChange={set}
          />
        ) : (
          <BotPicker botId={c.botId} onPick={(botId) => set({ botId })} />
        )}
      </SettingsSection>
      <SettingsSection title="Task">
        <Field
          id="ai-prompt"
          label="What should it do"
          required
          hint="Add data from earlier steps with + (or drag it from the Data tab). Data from apps is marked as data, so text inside an email cannot give the bot orders."
        >
          <TemplateInput
            id="ai-prompt"
            multiline
            className="min-h-32"
            placeholder="e.g. Summarize this email in 2 sentences and say if it needs a reply today: [subject] — [body]"
            value={c.prompt}
            onChange={(prompt) => set({ prompt })}
          />
        </Field>
        <Field id="ai-output" label="Answer as" hint={OUTPUT_HINTS[c.output]}>
          <Select
            value={c.output}
            onValueChange={(v) => {
              const output = v as Output;
              // Starting a structured answer: one example row, so the form shows how it works.
              const schema =
                output === "structured" && c.schema.length === 0
                  ? [
                      {
                        name: "answer",
                        type: "text" as const,
                        description: "",
                        choices: [],
                      },
                    ]
                  : c.schema;
              set({ output, schema });
            }}
          >
            <SelectTrigger id="ai-output" className="w-full">
              <SelectValue>{OUTPUTS[c.output]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OUTPUTS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {c.output === "structured" && (
          <AiOutputFields
            blockId={block.id}
            fields={c.schema}
            onChange={(schema) => set({ schema })}
          />
        )}
        {c.agent === "bot" && (
          <>
            <div className="flex items-start justify-between gap-3">
              <label htmlFor="ai-apps" className="text-xs">
                Let it read the bot&apos;s connected apps
                <span className="block text-muted-foreground">
                  Read only: it can look things up, never send or change.
                </span>
                {c.useApps && <AiAppsNote botId={c.botId} />}
              </label>
              <Switch
                id="ai-apps"
                checked={c.useApps}
                onCheckedChange={(v) => set({ useApps: v })}
              />
            </div>
            <AiKnowledge files={c.files} onChange={(files) => set({ files })} />
          </>
        )}
      </SettingsSection>
    </>
  );
}
