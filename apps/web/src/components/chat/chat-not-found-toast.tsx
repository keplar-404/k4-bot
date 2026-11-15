"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

// /dashboard/chat/[id] sends users here with ?notfound=1 when the chat is missing.
export function ChatNotFoundToast() {
	const missing = useSearchParams().get("notfound") === "1";
	const router = useRouter();
	useEffect(() => {
		if (!missing) return;
		toast.error("Chat not found");
		router.replace("/dashboard/chat"); // drop the flag so a reload doesn't repeat it
	}, [missing, router]);
	return null;
}
