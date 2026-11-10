"use client";

import { useEffect } from "react";
import { Markdown } from "@/components/markdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { parseCsv } from "./csv";

const MAX_ROWS = 500;

/** Markdown rendered; CSV as a table (first MAX_ROWS rows); anything else (code, JSON, logs) as monospace text. */
export function TextView({
  blob,
  mimeType,
  name,
}: {
  blob: Blob;
  mimeType: string;
  name: string;
}) {
  const [{ text }, , store] = useLocalStore(() => ({
    text: null as string | null,
  }));
  const setText = fieldSetter(store, "text");
  useEffect(() => {
    void blob.text().then(setText);
  }, [blob, setText]);
  if (text === null) return null;

  if (mimeType === "text/markdown" || name.endsWith(".md")) {
    return (
      <div className="p-4">
        <Markdown>{text}</Markdown>
      </div>
    );
  }
  if (mimeType === "text/csv" || name.endsWith(".csv")) {
    const [head = [], ...rows] = parseCsv(text);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a static table; columns never reorder
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, MAX_ROWS).map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a static table; rows never reorder
            <TableRow key={i}>
              {r.map((c, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a static table; cells never reorder
                <TableCell key={j}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  return (
    <pre className="p-4 font-mono text-xs whitespace-pre-wrap">{text}</pre>
  );
}
