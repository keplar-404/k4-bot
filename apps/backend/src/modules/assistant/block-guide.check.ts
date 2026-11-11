import assert from "node:assert/strict";
import { z } from "zod";
import { nodeSchema } from "../workflows/graph/schema";
import { BLOCK_GUIDE } from "./block-guide";

// The guide the assistant reads must match the real blocks: every kind has an entry, every setting it names exists, and
// every example config is accepted by the schema (so a copied example always saves).
const kinds = nodeSchema.options.map((o) => o.shape.kind.value as string);
assert.deepEqual([...BLOCK_GUIDE.map((b) => b.kind)].sort(), [...kinds].sort(), "one guide entry per block kind");

for (const g of BLOCK_GUIDE) {
  const option = nodeSchema.options.find((o) => o.shape.kind.value === g.kind)!;
  const props = Object.keys((z.toJSONSchema(option.shape.config as z.ZodType, { io: "input", unrepresentable: "any" }) as { properties?: object }).properties ?? {});
  for (const f of g.fields) assert.ok(props.includes(f.name), `${g.kind}: "${f.name}" is not a setting of this block`);
  const parsed = nodeSchema.safeParse({ id: "x", kind: g.kind, position: { x: 0, y: 0 }, config: g.example });
  assert.ok(parsed.success, `${g.kind}: the example is not valid: ${parsed.success ? "" : z.prettifyError(parsed.error).slice(0, 200)}`);
  assert.ok(g.use.length > 10 && g.output.length > 0, `${g.kind}: needs use and output text`);
}

console.log(`block guide: ${BLOCK_GUIDE.length} blocks ok`);
