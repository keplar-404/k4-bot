// Re-encrypts every saved provider key with the current PROVIDER_KEY_SECRET, after a
// rotation (see masterKey in @repo/shared/providers). Safe to run twice.
//   cd apps/backend && bun run providers:reseal
import { decryptKey, encryptKey } from "@repo/shared/providers";
import { userProviderKey } from "@repo/shared/schema";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db";

const rows = await db.select().from(userProviderKey);
let failed = 0;
for (const r of rows) {
	try {
		const plain = decryptKey(r.userId, r.provider, r.sealed);
		await db
			.update(userProviderKey)
			.set({ sealed: encryptKey(r.userId, r.provider, plain) })
			.where(
				and(
					eq(userProviderKey.userId, r.userId),
					eq(userProviderKey.provider, r.provider),
				),
			);
	} catch {
		failed++; // opened by neither key: left as is, the user must save it again
		console.error(`can't open ${r.provider} for user ${r.userId}`);
	}
}
console.log(`${rows.length - failed} resealed, ${failed} failed`);
await pool.end();
if (failed) process.exit(1);
