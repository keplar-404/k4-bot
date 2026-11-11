import assert from "node:assert/strict";
import { z } from "zod";
import { createAssistantTools } from "./tools";

// Every tool schema is sent to the model as JSON Schema when the agent starts. One that cannot be converted (a
// transform, a preprocess) stops every run with "Transforms cannot be represented in JSON Schema".
const tools = createAssistantTools({ env: {} as never, db: {} as never, userId: "u", workflowId: "w", runId: "r" });
for (const t of tools) {
  assert.doesNotThrow(() => z.toJSONSchema((t as unknown as { schema: z.ZodType }).schema), `${t.name} converts to JSON Schema`);
}
console.log(`assistant tools: ${tools.length} schemas ok`);
