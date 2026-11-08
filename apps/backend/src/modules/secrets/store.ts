import { and, count, eq, sql } from "drizzle-orm";
import type { Db } from "../../db";
import type { Env } from "../../config/env";
import { userSecret, workflow } from "../../db/schema";
import { encryptSecret, secretHint } from "../../shared/secrets";

export const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,40}$/;
export const MAX_SECRETS = 50;

/** Binds a stored secret to its owner, row and purpose: another user's or row's ciphertext does not decrypt. */
export const secretContext = (userId: string, recordId: string) => ({
  userId,
  recordId,
  purpose: "workflow-secret",
});

const byName = (userId: string, name: string) => and(eq(userSecret.userId, userId), eq(userSecret.name, name));

/** Names, labels and hints only: a value never leaves the server once saved. */
export function listSecrets(db: Db, userId: string) {
  return db
    .select({
      name: userSecret.name,
      label: userSecret.label,
      hint: userSecret.hint,
      updatedAt: userSecret.updatedAt,
    })
    .from(userSecret)
    .where(eq(userSecret.userId, userId))
    .orderBy(userSecret.name);
}

export async function secretExists(db: Db, userId: string, name: string) {
  const [row] = await db.select({ id: userSecret.id }).from(userSecret).where(byName(userId, name)).limit(1);
  return Boolean(row);
}

/** Saves (or replaces) a secret, encrypted. "limit" when a new one would pass MAX_SECRETS. */
export async function saveSecret(
  env: Env,
  db: Db,
  userId: string,
  secret: { name: string; label: string; value: string },
): Promise<"created" | "updated" | "limit"> {
  const [existing] = await db
    .select({ id: userSecret.id })
    .from(userSecret)
    .where(byName(userId, secret.name))
    .limit(1);

  if (!existing) {
    const [row] = await db.select({ n: count() }).from(userSecret).where(eq(userSecret.userId, userId));
    if ((row?.n ?? 0) >= MAX_SECRETS) return "limit";
  }

  const id = existing?.id ?? crypto.randomUUID();
  const value = await encryptSecret(env, secret.value, secretContext(userId, id));
  const fields = { label: secret.label, value, hint: secretHint(secret.value) };
  if (existing) {
    await db
      .update(userSecret)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(userSecret.id, id));
    return "updated";
  }
  await db.insert(userSecret).values({ id, userId, name: secret.name, ...fields });
  return "created";
}

export async function deleteSecret(db: Db, userId: string, name: string) {
  const rows = await db.delete(userSecret).where(byName(userId, name)).returning({ id: userSecret.id });
  return rows.length > 0;
}

/** Names of the user's live workflows that use {{secrets.NAME}} (they would start failing without it). */
export async function workflowsUsingSecret(db: Db, userId: string, name: string) {
  // `name` matches SECRET_NAME ([A-Z0-9_]), so it is safe inside the pattern.
  const pattern = String.raw`\{\{\s*secrets\.${name}\s*\}\}`;
  const rows = await db
    .select({ name: workflow.name })
    .from(workflow)
    .where(
      and(
        eq(workflow.userId, userId),
        eq(workflow.status, "active"),
        sql`${workflow.publishedGraph}::text ~ ${pattern}`,
      ),
    )
    .limit(5);
  return rows.map((row) => row.name);
}
