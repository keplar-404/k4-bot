// bun run src/features/workflows/builder/template/template-text.check.ts
import assert from "node:assert/strict";
import { docToTemplate, templateToDoc } from "./template-text";

const roundTrip = (s: string) => docToTemplate(templateToDoc(s));
for (const s of [
  "",
  "plain",
  "Hi {{trigger.data.name}}!",
  "{{a.b}}{{c}}",
  "line 1\n{{x.y}} line 2",
  "{{ spaced.path }}",
]) {
  assert.equal(
    roundTrip(s),
    s.replace("{{ spaced.path }}", "{{spaced.path}}"),
    s,
  );
}
const doc = templateToDoc("To {{steps.gmail_1.output.data.from}} now");
assert.deepEqual(
  doc.content?.[0]?.content?.map((n) => n.type),
  ["text", "dataRef", "text"],
);
assert.equal(
  doc.content?.[0]?.content?.[1]?.attrs?.path,
  "steps.gmail_1.output.data.from",
);
// Not a reference: single braces and invalid paths stay text.
assert.equal(
  templateToDoc("{not} {{bad path}}").content?.[0]?.content?.length,
  1,
);
console.log("template text: all checks passed");
