"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";

type DelayBlock = Extract<BlockBody, { kind: "logic.delay" }>;
type Config = DelayBlock["config"];
const UNITS = ["seconds", "minutes", "hours", "days"] as const;
const MODES: Record<Config["mode"], string> = {
  for: "For a set time (e.g. 2 hours)",
  until: "Until a date and time",
  next: "Until a day of the week and time",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Delay: wait for a while, until a date, or until the next chosen day and time (up to 7 days; waiting costs nothing). */
export function DelaySettings({
  block,
  update,
}: {
  block: DelayBlock;
  update: (b: DelayBlock) => void;
}) {
  const c = block.config;
  const set = (patch: Partial<Config>) =>
    update({ ...block, config: { ...c, ...patch } });
  const seconds =
    c.amount * { seconds: 1, minutes: 60, hours: 3600, days: 86400 }[c.unit];
  return (
    <SettingsSection title="Wait">
      <Field
        id="delay-mode"
        label="Wait"
        hint="The run pauses here, then goes on to the next block. Waiting costs nothing; at most 7 days."
      >
        <Select
          value={c.mode}
          onValueChange={(v) => v && set({ mode: v as Config["mode"] })}
        >
          <SelectTrigger id="delay-mode" className="w-full">
            <SelectValue>{MODES[c.mode]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MODES).map(([m, label]) => (
              <SelectItem key={m} value={m}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {c.mode === "for" && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <Field
            id="delay-amount"
            label="How long"
            hint="A whole number, e.g. 30."
          >
            <Input
              id="delay-amount"
              type="number"
              min={1}
              value={c.amount}
              onChange={(e) =>
                set({
                  amount: Math.max(
                    1,
                    Math.min(10000, Number.parseInt(e.target.value, 10) || 1),
                  ),
                })
              }
            />
          </Field>
          <Field id="delay-unit" label="In">
            <Select
              value={c.unit}
              onValueChange={(v) =>
                v && set({ unit: v as (typeof UNITS)[number] })
              }
            >
              <SelectTrigger id="delay-unit" className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="capitalize">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
      {c.mode === "for" && seconds > 7 * 86400 && (
        <p className="text-destructive text-xs">
          A delay can be at most 7 days.
        </p>
      )}
      {c.mode === "until" && (
        <Field
          id="delay-until"
          label="Go on at"
          required
          hint="Pick a date from an earlier step with +, or type one like 2026-12-01 09:00 (add +06:00 for your time zone; without it, UTC). A time already past goes on at once; at most 7 days ahead."
        >
          <TemplateInput
            id="delay-until"
            value={c.until}
            placeholder="2026-12-01 09:00, or pick a date with +"
            onChange={(until) => set({ until })}
          />
        </Field>
      )}
      {c.mode === "next" && (
        <>
          <Field
            id="delay-days"
            label="On these days"
            hint="The run goes on at the first chosen day and time after it gets here."
          >
            {/* shadcn ToggleGroup: several days can be on. Values are the day numbers (0 = Sunday). */}
            <ToggleGroup
              multiple
              variant="outline"
              size="sm"
              spacing={1}
              className="flex-wrap"
              aria-label="Days"
              value={c.days.map(String)}
              onValueChange={(v) =>
                set({ days: v.map(Number).sort((x, y) => x - y) })
              }
            >
              {DAYS.map((d, i) => (
                <ToggleGroupItem key={d} value={String(i)} className="px-2.5">
                  {d}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="delay-at" label="At (time)">
              <Input
                id="delay-at"
                type="time"
                value={c.at}
                onChange={(e) => e.target.value && set({ at: e.target.value })}
              />
            </Field>
            <Field
              id="delay-tz"
              label="Time zone"
              hint="Your city’s zone, e.g. Asia/Dhaka or Europe/London."
            >
              <Input
                id="delay-tz"
                value={c.timezone}
                placeholder="Asia/Dhaka"
                onChange={(e) => set({ timezone: e.target.value })}
              />
            </Field>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
