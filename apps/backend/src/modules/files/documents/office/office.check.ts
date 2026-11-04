import assert from "node:assert/strict";
import JSZip from "jszip";
import { readOffice } from "./index";
import { columnIndex } from "./xlsx";

/** Minimal but real OOXML files, built in memory (the parts each reader uses). */
const zip = async (files: Record<string, string>) => {
  const z = new JSZip();
  for (const [name, xml] of Object.entries(files)) z.file(name, xml);
  return new Uint8Array(await z.generateAsync({ type: "uint8array" }));
};
const store = new Map<string, string>();
const bucket = { get: async (k: string) => (store.has(k) ? { text: async () => store.get(k)! } : null), put: async (k: string, v: string) => void store.set(k, v) } as unknown as R2Bucket;
const file = (name: string, mimeType: string, bytes: Uint8Array) => ({ row: { name, mimeType, storageKey: `k/${name}` } as never, bytes });
const OOXML = "application/vnd.openxmlformats-officedocument.";

assert.equal(columnIndex("A"), 0);
assert.equal(columnIndex("AA"), 26);

// XLSX: shared string with `t` before `r`, an empty middle cell, a number, an inline string, an entity.
const xlsx = await zip({
  "xl/workbook.xml": '<workbook><sheets><sheet name="Sales &amp; Costs" sheetId="1"/></sheets></workbook>',
  "xl/sharedStrings.xml": "<sst><si><t>Region</t></si><si><r><t>Reve</t></r><r><t>nue</t></r></si><si><t>EU</t></si></sst>",
  "xl/worksheets/sheet1.xml":
    '<worksheet><sheetData><row r="1"><c t="s" r="A1"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="inlineStr"><is><t>x</t></is></c><c r="C2"><v>1600</v></c></row></sheetData></worksheet>',
});
const x = (await readOffice(bucket, file("a.xlsx", `${OOXML}spreadsheetml.sheet`, xlsx))).text;
assert.match(x, /## Sheet: Sales & Costs/);
assert.match(x, /\| Region \|  \| Revenue \|/, "shared strings by index, split runs joined, empty B1 keeps its place");
assert.match(x, /\| EU \| x \| 1600 \|/);

// PPTX: slide order 1, 2, 10; notes attached to their own slide through the rels file.
const p = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`;
const pptx = await zip({
  "ppt/slides/slide10.xml": p("Ten"),
  "ppt/slides/slide2.xml": p("Two &lt;b&gt;"),
  "ppt/slides/slide1.xml": p("One"),
  "ppt/slides/_rels/slide2.xml.rels": '<Relationships><Relationship Target="../notesSlides/notesSlide7.xml"/></Relationships>',
  "ppt/notesSlides/notesSlide7.xml": "<p:notes><a:p><a:r><a:t>Say hi</a:t></a:r></a:p><a:p><a:r><a:t>2</a:t></a:r></a:p></p:notes>",
});
const s = (await readOffice(bucket, file("d.pptx", `${OOXML}presentationml.presentation`, pptx))).text;
assert.ok(s.indexOf("Slide 1") < s.indexOf("Slide 2") && s.indexOf("Slide 2") < s.indexOf("Slide 10"), "numeric slide order");
assert.match(s, /## Slide 2\nTwo <b>\n\nNotes:\nSay hi/, "entities decoded, notes under their slide, bare slide number dropped");

// DOCX through mammoth.
const docx = await zip({
  "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  "word/document.xml": '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Word</w:t></w:r></w:p></w:body></w:document>',
});
assert.match((await readOffice(bucket, file("c.docx", `${OOXML}wordprocessingml.document`, docx))).text, /Hello Word/);

// Bad and legacy files are NOT DONE, never a crash; the cache is used on a second read.
assert.match((await readOffice(bucket, file("bad.xlsx", `${OOXML}spreadsheetml.sheet`, new Uint8Array([1, 2, 3])))).text, /^NOT DONE: could not read/);
assert.match((await readOffice(bucket, file("old.xls", "application/vnd.ms-excel", new Uint8Array()))).text, /old Office format.*\.xlsx/);
assert.ok(store.has("k/a.xlsx.parsed/office.md"), "converted markdown cached");

console.log("office: all checks passed");
