"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlockBody } from "../blocks";
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
        hint="Shown when the run reaches this block. Paste data to check, e.g. “Send this reply? {{steps.ai_1.output.text}}”."
      >
        <Textarea
          id="approval-message"
          rows={4}
          maxLength={2000}
          value={block.config.message}
          placeholder="Continue this run?"
          onChange={(e) => set({ message: e.target.value })}
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
      <p className="text-muted-foreground text-xs">
        Approve or decline in the run banner or this block&apos;s Last run tab.
        Declined stops the steps after it; the run itself still succeeds. A
        waiting run costs nothing.
      </p>
    </SettingsSection>
  );
}
