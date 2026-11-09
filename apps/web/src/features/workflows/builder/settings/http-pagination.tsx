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
import { Field, SettingsSection } from "./field";

type Pagination = Extract<
  BlockBody,
  { kind: "action.http" }
>["config"]["pagination"];

const MODES: Record<Pagination["mode"], string> = {
  none: "One request",
  page: "Page numbers (?page=1, 2, 3…)",
  cursor: "A cursor from each response",
  next_url: "A next-page URL from each response",
};

/** Pagination: several requests, their items collected into {{steps.<id>.output.items}}. */
export function HttpPagination({
  value,
  onChange,
}: {
  value: Pagination;
  onChange: (p: Pagination) => void;
}) {
  const set = (patch: Partial<Pagination>) => onChange({ ...value, ...patch });
  const num = (v: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Number.parseInt(v, 10) || min));
  return (
    <SettingsSection title="Pages">
      <Field
        id="http-pages"
        label="Get"
        hint={
          value.mode === "none"
            ? undefined
            : "Each page's items are collected into output.items (up to 10 pages). It stops at an empty page or when there is no next page."
        }
      >
        <Select
          value={value.mode}
          onValueChange={(v) => v && set({ mode: v as Pagination["mode"] })}
        >
          <SelectTrigger id="http-pages" className="w-full">
            <SelectValue>{MODES[value.mode]}</SelectValue>
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
      {value.mode !== "none" && (
        <>
          <Field
            id="http-items"
            label="Where the items are"
            hint="The path to the list in each response, e.g. data or results.items. Empty: the response is the list."
          >
            <Input
              id="http-items"
              value={value.itemsPath}
              placeholder="data"
              onChange={(e) => set({ itemsPath: e.target.value })}
            />
          </Field>
          {value.mode !== "next_url" && (
            <Field id="http-param" label="Query parameter">
              <Input
                id="http-param"
                value={value.param}
                placeholder={value.mode === "page" ? "page" : "cursor"}
                onChange={(e) =>
                  set({ param: e.target.value.replace(/[^A-Za-z0-9_.-]/g, "") })
                }
              />
            </Field>
          )}
          {value.mode === "page" && (
            <Field id="http-start" label="First page">
              <Input
                id="http-start"
                type="number"
                min={0}
                value={value.start}
                onChange={(e) => set({ start: num(e.target.value, 0, 1_000_000) })}
              />
            </Field>
          )}
          {value.mode !== "page" && (
            <Field
              id="http-next"
              label={value.mode === "cursor" ? "Where the next cursor is" : "Where the next URL is"}
              hint="The path in each response, e.g. next_cursor or links.next."
            >
              <Input
                id="http-next"
                value={value.nextPath}
                onChange={(e) => set({ nextPath: e.target.value })}
              />
            </Field>
          )}
          <Field id="http-max-pages" label="At most (pages)">
            <Input
              id="http-max-pages"
              type="number"
              min={1}
              max={10}
              value={value.maxPages}
              onChange={(e) => set({ maxPages: num(e.target.value, 1, 10) })}
            />
          </Field>
        </>
      )}
    </SettingsSection>
  );
}
