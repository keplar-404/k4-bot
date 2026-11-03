import { z } from "zod";
import type { CatalogMcpServer } from "../catalog/mcp";
import { secretHint, SecretsUnavailableError } from "../../../shared/secrets";

const secretsRecord = z.record(z.string().max(40), z.string().trim().min(1).max(4000));
export const connectSchema = z.object({ serverId: z.string().min(1).max(40), secrets: secretsRecord.optional() });
export const secretsSchema = z.object({ secrets: secretsRecord });

/** Only the catalog entry's own fields, in clear: what gets tested and then encrypted. */
export const pick = (entry: CatalogMcpServer, secrets: Record<string, string>) => Object.fromEntries(entry.fields.map((f) => [f.key, secrets[f.key]!]));
export const hintOf = (entry: CatalogMcpServer, clean: Record<string, string>) => (entry.fields[0] ? secretHint(clean[entry.fields[0].key]!) : null);
export const unavailable = (error: unknown) => {
  if (error instanceof SecretsUnavailableError) return { error: "UNAVAILABLE", message: error.message } as const;
  throw error;
};
