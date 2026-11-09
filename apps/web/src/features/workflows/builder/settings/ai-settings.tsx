"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BlockBody } from "../blocks";
import { AiAppsNote } from "./ai-apps-note";
import { AiKnowledge } from "./ai-knowledge";
import { BotPicker } from "./bot-picker";
import { Field, SettingsSection } from "./field";

type AiBlock = Extract<BlockBody, { kind: "ai.bot" }>;

/**
 * "Ask a bot": one of the user's bots does this step with its memory and web search, and may read its connected apps.
 * It cannot send, change or delete anything: put an app step after it to act on its answer.
 */
export function AiSettings({
  block,
  update,
}: {
  block: AiBlock;
  update: (b: AiBlock) => void;
}) {
  const set = (patch: Partial<AiBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });

  return (
    <>
      <SettingsSection title="Bot">
        <BotPicker
          botId={block.config.botId}
          onPick={(botId) => set({ botId })}
        />
      </SettingsSection>
      <SettingsSection title="Task">
        <Field
          id="ai-prompt"
          label="What should it do"
          required
          hint="Paste data from earlier steps, e.g. “Write a short, friendly reply to {{trigger.data.message_text}}”. Data from apps is marked as data, so text inside an email cannot give the bot orders."
        >
          <Textarea
            id="ai-prompt"
            rows={6}
            value={block.config.prompt}
            onChange={(e) => set({ prompt: e.target.value })}
          />
        </Field>
        <Field
          id="ai-output"
          label="Answer as"
          hint={
            block.config.output === "json"
              ? "Read fields with {{steps.<this block>.output.json.<field>}}. Say in the task which fields to return."
              : "Read it with {{steps.<this block>.output.text}}."
          }
        >
          <Select
            value={block.config.output}
            onValueChange={(v) => set({ output: v as "text" | "json" })}
          >
            <SelectTrigger id="ai-output" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="json">JSON fields</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="ai-apps" className="text-xs">
            Let it read the bot&apos;s connected apps
            <span className="block text-muted-foreground">
              Read only: it can look things up, never send or change.
            </span>
            {block.config.useApps && <AiAppsNote botId={block.config.botId} />}
          </label>
          <Switch
            id="ai-apps"
            checked={block.config.useApps}
            onCheckedChange={(v) => set({ useApps: v })}
          />
        </div>
        <AiKnowledge
          files={block.config.files}
          onChange={(files) => set({ files })}
        />
      </SettingsSection>
    </>
  );
}
