"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "./decide-settings";
import { QuestionCriteria } from "./question-criteria";

const TYPES: Array<[Question["type"], string, string]> = [
  ["noul", "Yes / no", "noul"],
  ["choice", "Pick one", "choice"],
  ["score", "Score on levels", "score"],
];

/** One question: its name (the output key), type, wording, and the type's own criteria. */
export function QuestionRow({
  question: q,
  blockId,
  onChange,
  onRemove,
}: {
  question: Question;
  blockId: string;
  onChange: (q: Question) => void;
  onRemove?: () => void;
}) {
  const field = TYPES.find(([t]) => t === q.type)?.[2] ?? "noul";
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2.5">
      <div className="grid grid-cols-[1fr_1.2fr_auto] gap-2">
        <Input
          aria-label="Answer name"
          value={q.id}
          maxLength={40}
          onChange={(e) =>
            onChange({
              ...q,
              id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            })
          }
        />
        <Select
          value={q.type}
          onValueChange={(v) => onChange({ ...q, type: v as Question["type"] })}
        >
          <SelectTrigger aria-label="Question type" className="w-full">
            <SelectValue>{TYPES.find(([t]) => t === q.type)?.[1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(([t, label]) => (
              <SelectItem key={t} value={t}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onRemove && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove question"
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      <Textarea
        aria-label="Question"
        rows={2}
        maxLength={2000}
        value={q.instructions}
        placeholder={
          q.type === "noul"
            ? "Is the customer asking for a refund?"
            : q.type === "choice"
              ? "Which team should handle this?"
              : "How urgent is this?"
        }
        onChange={(e) => onChange({ ...q, instructions: e.target.value })}
      />
      <QuestionCriteria question={q} onChange={onChange} />
      <code
        className="truncate text-[11px] text-muted-foreground"
        title="Read the answer in later blocks"
      >
        {`{{steps.${blockId}.output.answers.${q.id}.${field}}}`}
      </code>
    </div>
  );
}
