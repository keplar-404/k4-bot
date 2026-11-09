import type { ListConfig, MergeConfig } from "../graph/list-blocks";
import { FatalBlockError } from "./errors";

/** A list given as a list, or as JSON text of one (a Set field, an HTTP text body). */
export function asList(value: unknown, what = "This block"): unknown[] {
  let v = value;
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      v = JSON.parse(v);
    } catch {
      // Falls through to the error below.
    }
  }
  if (!Array.isArray(v)) throw new FatalBlockError(`${what} needs a list. Pick a field that holds a list (shown as “list” in the data).`);
  return v;
}

/** `item.a.b`, or the item itself when there is no field. */
export const at = (item: unknown, field: string): unknown =>
  field ? field.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), item) : item;

const has = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const numbers = (items: unknown[], field: string) => items.map((i) => Number(at(i, field))).filter((n) => Number.isFinite(n));

export function runMerge(config: MergeConfig, values: unknown[]) {
  switch (config.mode) {
    case "append":
      return { items: values.filter(has).flatMap((v) => (Array.isArray(v) ? v : [v])) };
    case "combine":
      return { result: Object.assign({}, ...values.filter(isObject)) };
    case "first":
      return { result: values.find(has) ?? null };
    case "by_key": {
      const [left, right] = [asList(values[0] ?? [], "Merge"), asList(values[1] ?? [], "Merge")];
      const byKey = new Map(right.map((r) => [String(at(r, config.key)), r]));
      return {
        items: left.map((l) => {
          const match = byKey.get(String(at(l, config.key)));
          return { ...(isObject(l) ? l : { value: l }), ...(isObject(match) ? match : {}) };
        }),
      };
    }
  }
}

export function runList(config: ListConfig, value: unknown) {
  const items = asList(value, "List tools");
  const { field } = config;
  switch (config.operation) {
    case "split_out":
      return { items: items.flatMap((i) => { const inner = at(i, field); return Array.isArray(inner) ? inner : has(inner) ? [inner] : []; }) };
    case "pluck":
      return { items: items.map((i) => at(i, field) ?? null) };
    case "count":
      return { result: items.length };
    case "sum":
      return { result: numbers(items, field).reduce((a, b) => a + b, 0) };
    case "average": {
      const n = numbers(items, field);
      return { result: n.length ? n.reduce((a, b) => a + b, 0) / n.length : null };
    }
    case "min":
    case "max": {
      const n = numbers(items, field);
      return { result: n.length ? Math[config.operation](...n) : null };
    }
    case "sort": {
      const dir = config.order === "desc" ? -1 : 1;
      return { items: [...items].sort((a, b) => dir * String(at(a, field) ?? "").localeCompare(String(at(b, field) ?? ""), undefined, { numeric: true })) };
    }
    case "group_by": {
      const groups: Record<string, unknown[]> = {};
      for (const i of items) (groups[String(at(i, field) ?? "")] ??= []).push(i);
      return { result: groups, count: Object.keys(groups).length };
    }
    case "unique": {
      const seen = new Set<string>();
      return { items: items.filter((i) => { const k = JSON.stringify(at(i, field) ?? null); return seen.has(k) ? false : (seen.add(k), true); }) };
    }
    case "first_n":
      return { items: items.slice(0, config.amount) };
  }
}
