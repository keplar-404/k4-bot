"use client";

import { useEffect } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

const MAX_ROWS = 500;
type Sheet = { name: string; rows: string[][] };

/** Each cell's shown text: formula results, rich text and dates as text. */
const shown = (v: unknown): string =>
  v == null
    ? ""
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : typeof v === "object"
        ? String(
            (v as { result?: unknown; text?: unknown }).result ??
              (v as { text?: unknown }).text ??
              "",
          )
        : String(v);

/** An Excel workbook as tables, one sheet at a time (exceljs, loaded only when a .xlsx opens). */
export function XlsxView({ blob }: { blob: Blob }) {
  const [{ sheets, active, error }, , store] = useLocalStore(() => ({
    sheets: null as Sheet[] | null,
    active: 0,
    error: null as string | null,
  }));
  const setSheets = fieldSetter(store, "sheets");
  const setActive = fieldSetter(store, "active");
  const setError = fieldSetter(store, "error");

  useEffect(() => {
    let live = true;
    void Promise.all([import("exceljs"), blob.arrayBuffer()])
      .then(async ([mod, data]) => {
        const wb = new mod.default.Workbook();
        await wb.xlsx.load(data);
        const out = wb.worksheets.map((ws) => {
          const rows: string[][] = [];
          ws.eachRow({ includeEmpty: false }, (row) => {
            if (rows.length < MAX_ROWS)
              rows.push(
                Array.from({ length: ws.columnCount }, (_, i) =>
                  shown(row.getCell(i + 1).value),
                ),
              );
          });
          return { name: ws.name, rows };
        });
        if (live) setSheets(out);
      })
      .catch(
        () =>
          live &&
          setError("This workbook could not be shown. Download it instead."),
      );
    return () => {
      live = false;
    };
  }, [blob, setError, setSheets]);

  if (error)
    return <p className="p-4 text-sm text-muted-foreground">{error}</p>;
  if (!sheets) return null;
  const sheet = sheets[active];
  return (
    <div className="flex flex-col gap-2 p-2">
      {sheets.length > 1 && (
        <Tabs
          value={String(active)}
          onValueChange={(v) => setActive(Number(v))}
        >
          <TabsList>
            {sheets.map((s, i) => (
              <TabsTrigger key={s.name} value={String(i)}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <Table>
        <TableBody>
          {sheet?.rows.map((r, i) => (
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
      {sheet && sheet.rows.length >= MAX_ROWS && (
        <p className="text-xs text-muted-foreground">
          Showing the first {MAX_ROWS} rows.
        </p>
      )}
    </div>
  );
}
