import { createUserDesktop, desktopExists } from "@repo/shared/desktop";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { userDesktop } from "./db/app-schema";

// The only place a desktop is created: one per user, at sign-in. The agent never
// creates one. The advisory lock makes two sign-ins at once create just one, and a
// desktop that E2B no longer has is rebuilt.
export function ensureUserDesktop(userId: string) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
		const [row] = await tx
			.select()
			.from(userDesktop)
			.where(eq(userDesktop.userId, userId));
		if (row && (await desktopExists(row.sandboxId))) return;
		const sandboxId = await createUserDesktop(userId);
		await tx
			.insert(userDesktop)
			.values({ userId, sandboxId })
			.onConflictDoUpdate({ target: userDesktop.userId, set: { sandboxId } });
	});
}
