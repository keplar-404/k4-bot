"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Question } from "./decide-settings";

/**
 * The criteria of a question: what counts as yes and no, the choices (with what each means), or the score's levels
 * from lowest to highest. Saying what does NOT count is what makes answers accurate.
 */
export function QuestionCriteria({
  question: q,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  if (q.type === "noul") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Counts as yes"
          placeholder="Counts as yes (optional)"
          maxLength={500}
          value={q.yes ?? ""}
          onChange={(e) => onChange({ ...q, yes: e.target.value || undefined })}
        />
        <Input
          aria-label="Counts as no"
          placeholder="Counts as no (optional)"
          maxLength={500}
          value={q.no ?? ""}
          onChange={(e) => onChange({ ...q, no: e.target.value || undefined })}
        />
      </div>
    );
  }
  if (q.type === "choice") {
    const set = (choices: Question["choices"]) => onChange({ ...q, choices });
    return (
      <div className="flex flex-col gap-1.5">
        {q.choices.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows
          <div key={i} className="grid grid-cols-[0.8fr_1.4fr_auto] gap-1.5">
            <Input
              aria-label="Choice"
              placeholder="billing"
              maxLength={40}
              value={c.label}
              onChange={(e) =>
                set(
                  q.choices.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
            />
            <Input
              aria-label="What it means"
              placeholder="What it means"
              maxLength={500}
              value={c.description}
              onChange={(e) =>
                set(
                  q.choices.map((x, j) =>
                    j === i ? { ...x, description: e.target.value } : x,
                  ),
                )
              }
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove choice"
              onClick={() => set(q.choices.filter((_, j) => j !== i))}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        {q.choices.length < 50 && (
          <Button
            size="xs"
            variant="ghost"
            className="self-start"
            onClick={() => set([...q.choices, { label: "", description: "" }])}
          >
            <PlusIcon /> Add choice
          </Button>
        )}
      </div>
    );
  }
  const setLevels = (levels: string[]) => onChange({ ...q, levels });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        Levels, lowest first (the answer is 0 at the lowest, 1 at the highest)
      </span>
      {q.levels.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows
        <div key={i} className="flex gap-1.5">
          <Input
            aria-label={`Level ${i + 1}`}
            placeholder={i === 0 ? "Not urgent" : "Urgent"}
            maxLength={300}
            value={l}
            onChange={(e) =>
              setLevels(q.levels.map((x, j) => (j === i ? e.target.value : x)))
            }
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove level"
            onClick={() => setLevels(q.levels.filter((_, j) => j !== i))}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      {q.levels.length < 10 && (
        <Button
          size="xs"
          variant="ghost"
          className="self-start"
          onClick={() => setLevels([...q.levels, ""])}
        >
          <PlusIcon /> Add level
        </Button>
      )}
    </div>
  );
}
