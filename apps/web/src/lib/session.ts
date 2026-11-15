import { auth } from "@/lib/auth/server";

// Runtime-only: reads request cookies, so call it inside <Suspense>.
export async function getSession() {
	const { data } = await auth.getSession();
	return data?.user ? { user: data.user } : null;
}
