"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

// The image is private. The backend checks it is the user's and returns a short link.
export function Screenshot({ k }: { k: string }) {
	const [url, setUrl] = useState<string>();
	useEffect(() => {
		let live = true;
		void api.api.chats.screenshot
			.$get({ query: { key: k } })
			.then(async (res) => {
				if (live && res.ok) setUrl((await res.json()).url);
			});
		return () => {
			live = false;
		};
	}, [k]);
	if (!url) return <Skeleton className="aspect-video w-full rounded-md" />;
	return (
		// biome-ignore lint/performance/noImgElement: short-lived signed link
		<img
			src={url}
			alt="Desktop screenshot after this action"
			className="max-w-full rounded-md border"
		/>
	);
}
