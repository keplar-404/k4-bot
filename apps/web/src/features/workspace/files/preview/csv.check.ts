import assert from "node:assert/strict";
import { parseCsv } from "./csv";

assert.deepEqual(parseCsv("a,b\n1,2"), [
  ["a", "b"],
  ["1", "2"],
]);
assert.deepEqual(
  parseCsv('name,note\n"Smith, J","said ""hi"""\r\nx,'),
  [
    ["name", "note"],
    ["Smith, J", 'said "hi"'],
    ["x", ""],
  ],
  "quotes, escaped quotes, CRLF, empty last cell",
);
assert.deepEqual(
  parseCsv('"multi\nline",z'),
  [["multi\nline", "z"]],
  "newline inside quotes stays in the cell",
);
console.log("csv: all checks passed");
