import type { Db } from "../../../../db";
import type { Env } from "../../../../config/env";
import { loadSecrets, SecretMissingError } from "../../../secrets/load";
import type { WorkflowNode } from "../../graph/schema";
import { FatalBlockError, userMessage } from "../errors";
import type { BlockResult } from "../execute-block";
import { redact, secretNamesIn } from "../redact";
import { resolveDeep, type RunContext } from "../template";
import { runApp } from "./app";
import { runHttp } from "./http";

export type ActionNode = Extract<WorkflowNode, { kind: "action.app" | "action.http" }>;

const MAX_OUTPUT_CHARS = 64 * 1024;

/** A stored output is capped. A cut one says so, so nothing downstream mistakes half a value for a whole one. */
export function limitOutput(value: unknown): unknown {
  const text = JSON.stringify(value ?? null);
  if (text.length <= MAX_OUTPUT_CHARS) return value ?? null;
  return { truncated: true, preview: text.slice(0, MAX_OUTPUT_CHARS) };
}

/**
 * App and HTTP blocks, the only ones that may use {{secrets.NAME}}. Secrets are decrypted here, for this call only,
 * and every secret value is scrubbed from the input, output and error before anything is stored or returned.
 */
export async function runAction(
  env: Env,
  db: Db,
  node: ActionNode,
  ctx: RunContext,
  run: { id: string; userId: string },
): Promise<BlockResult> {
  let secrets: Record<string, string> = {};
  let input: unknown = node.config;
  try {
    secrets = await loadSecrets(env, db, run.userId, secretNamesIn(node.config));
    const scope = { ...ctx, secrets };

    let output: unknown;
    if (node.kind === "action.app") {
      const args = resolveDeep(node.config.arguments, scope);
      input = { ...node.config, arguments: args };
      output = await runApp(env, run.userId, node.config, args);
    } else {
      const request = resolveDeep(node.config, scope);
      input = request;
      output = await runHttp(env, run.userId, run.id, request);
    }
    return { ok: true, input: redact(input, secrets), output: redact(limitOutput(output), secrets) };
  } catch (error) {
    const retryable = !(error instanceof FatalBlockError || error instanceof SecretMissingError);
    return {
      ok: false,
      input: redact(input, secrets),
      error: redact(userMessage(error), secrets),
      retryable,
    };
  }
}
