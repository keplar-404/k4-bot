"use client";

import { blockTitle } from "../block-label";
import type { BlockBody } from "../blocks";
import { type DataField, fieldsOf, useBlockSchema } from "./block-fields";

type Props = { query: string; onPick: (path: string) => void } & (
  | { block: BlockBody; title?: never; fields?: never }
  | { block?: never; title: string; fields: DataField[] }
);

/** One earlier block in the data picker: its name, then each of its fields (plus "all of it"). */
export function PickerBlock(props: Props) {
  return props.block ? (
    <BlockFields
      block={props.block}
      query={props.query}
      onPick={props.onPick}
    />
  ) : (
    <FieldList
      title={props.title}
      fields={props.fields}
      query={props.query}
      onPick={props.onPick}
    />
  );
}

function BlockFields({
  block,
  query,
  onPick,
}: {
  block: BlockBody;
  query: string;
  onPick: (path: string) => void;
}) {
  const { prefix, schema, loading } = useBlockSchema(block);
  const fields: DataField[] = [
    { path: prefix, name: "All of it", type: "object" },
    ...(schema ? fieldsOf(schema, prefix) : []),
  ];
  const unknown =
    !loading &&
    block.kind.endsWith(".app") &&
    !Object.keys(schema?.properties ?? {}).length;
  return (
    <FieldList
      title={blockTitle(block)}
      fields={fields}
      query={query}
      onPick={onPick}
      loading={loading}
      hint={
        unknown
          ? "Fields not described: test this step or pin a sample to list them."
          : undefined
      }
    />
  );
}

function FieldList(p: {
  title: string;
  fields: DataField[];
  query: string;
  onPick: (path: string) => void;
  loading?: boolean;
  hint?: string;
}) {
  const shown = p.fields.filter(
    (f) =>
      !p.query ||
      `${p.title} ${f.name} ${f.description ?? ""}`
        .toLowerCase()
        .includes(p.query),
  );
  if (shown.length === 0 && !p.loading) return null;
  return (
    <section className="flex flex-col">
      <p className="px-2 pb-1 font-medium text-muted-foreground text-xs">
        {p.title}
      </p>
      {p.loading && (
        <p className="px-2 text-muted-foreground text-xs">
          Loading its fields…
        </p>
      )}
      {p.hint && !p.query && (
        <p className="px-2 pb-1 text-muted-foreground text-xs">{p.hint}</p>
      )}
      {shown.map((f) => (
        <button
          key={f.path}
          type="button"
          onClick={() => p.onPick(f.path)}
          className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          title={f.description ?? `{{${f.path}}}`}
        >
          <span className="truncate">{f.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {f.type}
          </span>
        </button>
      ))}
    </section>
  );
}
