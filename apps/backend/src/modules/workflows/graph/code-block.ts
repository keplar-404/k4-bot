import { z } from "zod";

/** Code block limits: how long the code may run, and how much it may get and return. */
export const CODE_LIMITS = { maxSeconds: 120, codeChars: 20_000, inputBytes: 256 * 1024, outputBytes: 64 * 1024 } as const;

/**
 * Code (n8n's Code node): JavaScript (Node.js) run in a fresh E2B sandbox, never in the Worker. `inputs` become the
 * `input` object the code reads (values may hold {{references}}, never secrets); the code `return`s the result,
 * read as {{steps.<id>.output.result}}. It is stopped after `timeoutSeconds`; the time it ran counts toward the
 * user's daily sandbox minutes.
 */
export const codeConfig = z.object({
  code: z.string().max(CODE_LIMITS.codeChars).default("return { hello: input.name ?? 'world' };"),
  inputs: z
    .array(z.object({ key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/), value: z.string().max(4000) }))
    .max(20)
    .default([]),
  timeoutSeconds: z.number().int().min(1).max(CODE_LIMITS.maxSeconds).default(30),
});

export type CodeConfig = z.infer<typeof codeConfig>;
