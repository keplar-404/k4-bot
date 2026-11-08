import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db";
import type { Env } from "../../config/env";
import { userSecret } from "../../db/schema";
import { decryptSecret } from "../../shared/secrets";
import { secretContext } from "./store";

export class SecretMissingError extends Error {
  constructor(readonly secretName: string) {
    super(`The secret ${secretName} is not saved. Add it under Secrets.`);
  }
}

/** Decrypts the named secrets of one user, on the server, for the block that needs them. */
export async function loadSecrets(env: Env, db: Db, userId: string, names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};
  const rows = await db
    .select()
    .from(userSecret)
    .where(and(eq(userSecret.userId, userId), inArray(userSecret.name, names)));

  const values: Record<string, string> = {};
  for (const row of rows) {
    values[row.name] = await decryptSecret(env, row.value, secretContext(userId, row.id));
  }
  const missing = names.find((name) => !(name in values));
  if (missing) throw new SecretMissingError(missing);
  return values;
}
