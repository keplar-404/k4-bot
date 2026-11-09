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

type ApprovalBlock = Extract<BlockBody, { kind: "logic.approval" }>;

/** Ask me first: the run waits here until you approve or decline it in this builder. */
export function ApprovalSettings({
  block,
  update,
}: {
  block: ApprovalBlock;
  update: (b: ApprovalBlock) => void;
}) {
  const set = (patch: Partial<ApprovalBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  return (
    <SettingsSection title="Ask">
      <Field
        id="approval-message"
        label="What to ask"
        hint="Shown when the run reaches this block. Add data to check with +, or drag it from the Data tab."
      >
        <TemplateInput
          id="approval-message"
          multiline
          value={block.config.message}
          placeholder="Continue this run?"
          onChange={(message) => set({ message })}
        />
      </Field>
      <Field
        id="approval-timeout"
        label="Wait up to (hours)"
        hint="With no answer by then, this block fails (1 to 168 hours)."
      >
        <Input
          id="approval-timeout"
          type="number"
          min={1}
          max={168}
          value={block.config.timeoutHours}
          onChange={(e) =>
            set({
              timeoutHours: Math.min(
                168,
                Math.max(1, Number.parseInt(e.target.value, 10) || 1),
              ),
            })
          }
        />
      </Field>
      <Field id="approval-timeout-action" label="If nobody answers in time">
        <Select
          value={block.config.onTimeout ?? "fail"}
          onValueChange={(v) => set({ onTimeout: v as "fail" | "decline" })}
        >
          <SelectTrigger id="approval-timeout-action" className="w-full">
            <SelectValue>
              {block.config.onTimeout === "decline"
                ? "Treat it as declined"
                : "Fail this block"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fail">Fail this block</SelectItem>
            <SelectItem value="decline">Treat it as declined</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <p className="text-muted-foreground text-xs">
        Answer on the Approvals page, in the run banner, or in this block&apos;s
        Last run tab. When a bot started the run, it tells you in its chat.
        Declined stops the steps after it; the run itself still succeeds. A
        waiting run costs nothing.
      </p>
    </SettingsSection>
  );
}
