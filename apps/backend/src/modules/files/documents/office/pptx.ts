import { entry, loadZip, numbered, texts } from "./xml";

/** Paragraphs of a slide or notes part: the text runs of each `<a:p>` joined, one paragraph per line. */
const paragraphs = (xml: string) =>
  [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((p) => texts(p[1]!, "a:t").join(""))
    .filter((t) => t.trim());

/**
 * A .pptx deck as markdown, slide by slide in deck order, each followed by its speaker notes. A slide's notes are found
 * through its relationships file (`ppt/slides/_rels/slideN.xml.rels` → `../notesSlides/notesSlideM.xml`).
 */
export async function pptxToMarkdown(bytes: Uint8Array): Promise<string> {
  const zip = await loadZip(bytes);
  const out: string[] = [];
  for (const slide of numbered(zip, /^ppt\/slides\/slide(\d+)\.xml$/)) {
    out.push(`## Slide ${slide.n}`, ...paragraphs(await entry(zip, slide.name)));
    const rels = await entry(zip, `ppt/slides/_rels/slide${slide.n}.xml.rels`);
    const target = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
    // The notes part repeats the slide number as text; drop lines that are only a number.
    const notes = target ? paragraphs(await entry(zip, `ppt/notesSlides/${target}`)).filter((t) => !/^\d+$/.test(t.trim())) : [];
    if (notes.length) out.push("", "Notes:", ...notes);
    out.push("");
  }
  return out.join("\n");
}
