"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BlockBody } from "../../blocks";
import { TemplateInput } from "../../template/template-input";
import { Field, SettingsSection } from "../field";
import { QuestionRow } from "./question-row";

type DecideBlock = Extract<BlockBody, { kind: "ai.decide" }>;
export type Question = DecideBlock["config"]["questions"][number];

const MAX_QUESTIONS = 16;
const nextId = (qs: Question[]) => {
  for (let n = qs.length + 1; ; n++)
    if (!qs.some((q) => q.id === `q${n}`)) return `q${n}`;
};

/**
 * Decide (Jev): typed questions about some data, answered with calibrated probabilities instead of text. Every question
 * is one output; route on it with an If block using ranges ("is greater than 0.7"), never "equals".
 */
export function DecideSettings({
  block,
  update,
}: {
  block: DecideBlock;
  update: (b: DecideBlock) => void;
}) {
  const set = (patch: Partial<DecideBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  const qs = block.config.questions;
  const setQ = (i: number, q: Question) =>
    set({ questions: qs.map((x, j) => (j === i ? q : x)) });
  return (
    <>
      <SettingsSection title="About this data">
        <Field
          id="decide-state"
          label="State"
          required
          hint="What the questions are about: add the email, message or record from earlier steps with +. It is sent as data, so text inside it cannot change the questions."
        >
          <TemplateInput
            id="decide-state"
            multiline
            value={block.config.state}
            onChange={(state) => set({ state })}
            placeholder="The ticket text, an email, a record…"
          />
        </Field>
      </SettingsSection>
      <SettingsSection title={`Questions (${qs.length}/${MAX_QUESTIONS})`}>
        {qs.map((q, i) => (
          <QuestionRow
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are controlled; an id being edited must not remount its row
            key={i}
            question={q}
            blockId={block.id}
            onChange={(next) => setQ(i, next)}
            onRemove={
              qs.length > 1
                ? () => set({ questions: qs.filter((_, j) => j !== i) })
                : undefined
            }
          />
        ))}
        {qs.length < MAX_QUESTIONS && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set({
                questions: [
                  ...qs,
                  {
                    id: nextId(qs),
                    type: "noul",
                    instructions: "",
                    choices: [],
                    levels: [],
                  },
                ],
              })
            }
          >
            <PlusIcon /> Add question
          </Button>
        )}
        <p className="text-muted-foreground text-xs">
          All questions are answered in one call, each on its own. Write what
          counts and what does not: wording matters more than thresholds.
        </p>
      </SettingsSection>
      <SettingsSection title="Model">
        <Field
          id="decide-model"
          label="Model"
          hint="TypeSafe model id. jev-latest follows new versions; pin one (e.g. jev-1.13.0) to keep thresholds stable."
        >
          <Input
            id="decide-model"
            value={block.config.model}
            maxLength={60}
            onChange={(e) => set({ model: e.target.value.trim() })}
          />
        </Field>
      </SettingsSection>
    </>
  );
}
