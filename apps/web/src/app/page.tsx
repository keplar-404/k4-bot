import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

async function AuthButton() {
	const session = await getSession();
	return (
		<Button
			nativeButton={false}
			render={<Link href={session ? "/dashboard/chat" : "/login"} />}
		>
			{session ? "Dashboard" : "Login"}
		</Button>
	);
}

export default function Home() {
	return (
		<main className="flex min-h-svh items-center justify-center">
			<Suspense fallback={<Button disabled>Loading…</Button>}>
				<AuthButton />
			</Suspense>
		</main>
	);
}
