import { headers } from "next/headers";
import { z } from "zod";

const sessionSchema = z
	.object({ user: z.object({ name: z.string(), email: z.string() }) })
	.nullable();

// Runtime-only: reads request cookies, so call it inside <Suspense>.
export async function getSession() {
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/auth/get-session`,
		{
			headers: { cookie: (await headers()).get("cookie") ?? "" },
			cache: "no-store",
		},
	);
	if (!res.ok) return null;
	return sessionSchema.parse(await res.json());
}
