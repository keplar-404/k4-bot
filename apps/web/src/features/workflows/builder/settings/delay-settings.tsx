"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BlockBody } from "../blocks";
import { TemplateInput } from "../template/template-input";
import { Field, SettingsSection } from "./field";

type DelayBlock = Extract<BlockBody, { kind: "logic.delay" }>;
type Config = DelayBlock["config"];
const UNITS = ["seconds", "minutes", "hours", "days"] as const;
const MODES: Record<Config["mode"], string> = { for: "For a while", until: "Until a date and time", next: "Until the next day and time" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Delay: wait for a while, until a date, or until the next chosen day and time (up to 7 days; waiting costs nothing). */
export function DelaySettings({ block, update }: { block: DelayBlock; update: (b: DelayBlock) => void }) {
  const c = block.config;
  const set = (patch: Partial<Config>) => update({ ...block, config: { ...c, ...patch } });
  const seconds = c.amount * { seconds: 1, minutes: 60, hours: 3600, days: 86400 }[c.unit];
  return (
    <SettingsSection title="Wait">
      <Field id="delay-mode" label="How">
        <Select value={c.mode} onValueChange={(v) => v && set({ mode: v as Config["mode"] })}>
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
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <Field id="delay-amount" label="Amount">
            <Input id="delay-amount" type="number" min={1} value={c.amount} onChange={(e) => set({ amount: Math.max(1, Math.min(10000, Number.parseInt(e.target.value, 10) || 1)) })} />
          </Field>
          <Field id="delay-unit" label="Unit">
            <Select value={c.unit} onValueChange={(v) => v && set({ unit: v as (typeof UNITS)[number] })}>
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
      {c.mode === "for" && seconds > 7 * 86400 && <p className="text-destructive text-xs">A delay can be at most 7 days.</p>}
      {c.mode === "until" && (
        <Field id="delay-until" label="Date and time" required hint="E.g. 2026-12-01T09:00:00+01:00, or a date from an earlier step. A time already past goes on at once; at most 7 days ahead.">
          <TemplateInput id="delay-until" value={c.until} placeholder="2026-12-01T09:00:00Z" onChange={(until) => set({ until })} />
        </Field>
      )}
      {c.mode === "next" && (
        <>
          <Field id="delay-days" label="On">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Days">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={c.days.includes(i)}
                  onClick={() => set({ days: c.days.includes(i) ? c.days.filter((x) => x !== i) : [...c.days, i].sort() })}
                  className={cn("rounded-md border px-2 py-1 text-xs", c.days.includes(i) && "border-primary bg-primary text-primary-foreground")}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="delay-at" label="At">
              <Input id="delay-at" type="time" value={c.at} onChange={(e) => e.target.value && set({ at: e.target.value })} />
            </Field>
            <Field id="delay-tz" label="Time zone">
              <Input id="delay-tz" value={c.timezone} placeholder="Europe/Berlin" onChange={(e) => set({ timezone: e.target.value })} />
            </Field>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
