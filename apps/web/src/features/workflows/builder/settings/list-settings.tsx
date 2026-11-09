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
import { LIST_OPS as OPS } from "./list-ops";

type ListBlock = Extract<BlockBody, { kind: "logic.list" }>;
type Op = ListBlock["config"]["operation"];

/** List tools: one operation on a list from an earlier step (pairs with For each and Merge). */
export function ListSettings({
  block,
  update,
}: {
  block: ListBlock;
  update: (b: ListBlock) => void;
}) {
  const { operation, input, field, order, amount } = block.config;
  const set = (patch: Partial<ListBlock["config"]>) =>
    update({ ...block, config: { ...block.config, ...patch } });
  const op = OPS.find((o) => o.op === operation);
  return (
    <SettingsSection title="List">
      <Field
        id="list-op"
        label="What to do"
        hint={op ? `Output — ${op.out}` : undefined}
      >
        <Select
          value={operation}
          onValueChange={(v) => v && set({ operation: v as Op })}
        >
          <SelectTrigger id="list-op" className="w-full">
            <SelectValue>{op?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OPS.map((o) => (
              <SelectItem key={o.op} value={o.op}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        id="list-input"
        label="The list"
        required
        hint="Pick a list with + (or drag one from the Data tab)."
      >
        <TemplateInput
          id="list-input"
          value={input}
          placeholder="Pick a list with +"
          onChange={(v) => set({ input: v })}
        />
      </Field>
      {op?.field && (
        <Field
          id="list-field"
          label={
            op.field === "required"
              ? "Field of each item"
              : "Field of each item (optional)"
          }
          required={op.field === "required"}
          hint="For example email or price; a dot reaches inside (address.city). Empty uses the item itself."
        >
          <Input
            id="list-field"
            value={field}
            maxLength={100}
            onChange={(e) => set({ field: e.target.value })}
          />
        </Field>
      )}
      {operation === "sort" && (
        <Field id="list-order" label="Order">
          <Select
            value={order}
            onValueChange={(v) => v && set({ order: v as "asc" | "desc" })}
          >
            <SelectTrigger id="list-order" className="w-full">
              <SelectValue>
                {order === "asc"
                  ? "A → Z, small → large"
                  : "Z → A, large → small"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">A → Z, small → large</SelectItem>
              <SelectItem value="desc">Z → A, large → small</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      {operation === "first_n" && (
        <Field id="list-amount" label="How many">
          <Input
            id="list-amount"
            type="number"
            min={1}
            max={1000}
            value={amount}
            onChange={(e) =>
              set({
                amount: Math.min(
                  1000,
                  Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                ),
              })
            }
          />
        </Field>
      )}
    </SettingsSection>
  );
}
