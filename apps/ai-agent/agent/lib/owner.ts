import { ForbiddenError } from "eve/channels/auth";

// eve adds no per-session access list, so this is the only lock on a conversation.
// New sessions have no owner yet. If the lookup fails we cannot tell, so we refuse.
export async function assertSessionOwner(
	lookup: () => Promise<string | null>,
	userId: string,
) {
	let owner: string | null;
	try {
		owner = await lookup();
	} catch {
		throw new ForbiddenError({
			message: "Cannot verify who owns this conversation.",
		});
	}
	if (owner !== null && owner !== userId) {
		throw new ForbiddenError({
			message: "This conversation belongs to another user.",
		});
	}
}
