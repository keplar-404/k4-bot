"use client";

import { DownloadIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { defaultStyles, FileIcon } from "react-file-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { openFile, type ViewFile } from "@/lib/chat-ui";
import { cn } from "@/lib/utils";

type File = ViewFile & { size?: number };

const bytes = new Intl.NumberFormat("en", {
	notation: "compact",
	style: "unit",
	unit: "byte",
	unitDisplay: "narrow",
});
// Signed links stay the same for 5 minutes (r2.ts presignDownload) and live 10: reuse
// each for 4, across reloads too (sessionStorage), so a reopened chat asks the backend
// nothing and the browser shows images from its cache.
const KEY = "k4.links";
const TTL = 4 * 60_000;
const links = new Map<string, { url: Promise<string | null>; at: number }>();
let saved: Record<string, { url: string; at: number }> = {};
try {
	saved = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
} catch {}
function link(key: string, inline?: boolean) {
	const id = `${key}|${inline ?? false}`;
	const hit = links.get(id);
	if (hit && Date.now() - hit.at < TTL) return hit.url;
	const old = saved[id];
	if (old && Date.now() - old.at < TTL) return Promise.resolve(old.url);
	const at = Date.now();
	const url = api.api.files
		.$get({ query: inline ? { key, inline: "1" } : { key } })
		.then(async (r) => (r.ok ? (await r.json()).url : null))
		.catch(() => null);
	links.set(id, { url, at });
	void url.then((u) => {
		if (!u) return;
		for (const [k, v] of Object.entries(saved))
			if (Date.now() - v.at >= TTL) delete saved[k];
		saved[id] = { url: u, at };
		try {
			sessionStorage.setItem(KEY, JSON.stringify(saved));
		} catch {}
	});
	return url;
}

/** A chat file: icon or thumbnail, name, type and size. Open shows it in the right panel. */
export function FileCard({
	file,
	compact,
	onDelete,
}: {
	file: File;
	compact?: boolean;
	onDelete?: () => void;
}) {
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	// Zip and unknown files have nothing to show.
	const openable = !/zip|octet-stream/.test(file.type ?? "zip");
	const image = /^image\/(?!hei)/.test(file.type ?? "");
	const [thumb, setThumb] = useState<string | null>(null);
	useEffect(() => {
		if (image) void link(file.key, true).then(setThumb);
	}, [image, file.key]);
	const meta = [
		ext.toUpperCase(),
		file.size !== undefined && bytes.format(file.size),
	]
		.filter(Boolean)
		.join(" · ");
	const open = () => openFile(file);

	return (
		<Card
			size="sm"
			className={cn(
				"min-w-0 gap-0 py-0",
				compact && "w-fit max-w-64 cursor-pointer hover:bg-accent",
			)}
			{...(compact &&
				openable && {
					role: "button",
					tabIndex: 0,
					onClick: open,
					onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && open(),
				})}
		>
			<div
				className={cn(
					"flex items-center gap-3 px-3",
					compact ? "py-1.5" : "py-2.5",
				)}
			>
				{thumb ? (
					// biome-ignore lint/performance/noImgElement: a signed R2 link, not a static asset
					<img
						src={thumb}
						alt=""
						className={cn(
							"shrink-0 rounded object-cover",
							compact ? "size-6" : "size-10",
						)}
					/>
				) : (
					// docs: npmjs.com/package/react-file-icon (Default Styles)
					<span className={cn("shrink-0", compact ? "w-6" : "w-8")}>
						<FileIcon
							extension={ext}
							{...defaultStyles[ext as keyof typeof defaultStyles]}
						/>
					</span>
				)}
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium" title={file.name}>
						{file.name}
					</span>
					<span className="block truncate text-xs text-muted-foreground">
						{meta}
					</span>
				</span>
				{!compact && (
					<>
						{openable && (
							<Button
								size="sm"
								variant="outline"
								className="cursor-pointer"
								onClick={open}
							>
								Open
							</Button>
						)}
						<Button
							size="icon-sm"
							variant="ghost"
							className="cursor-pointer"
							aria-label={`Download ${file.name}`}
							onClick={async () => {
								const url = await link(file.key);
								if (url) window.location.assign(url);
							}}
						>
							<DownloadIcon />
						</Button>
						{onDelete && (
							<Button
								size="icon-sm"
								variant="ghost"
								className="cursor-pointer"
								aria-label={`Delete ${file.name}`}
								onClick={onDelete}
							>
								<Trash2Icon />
							</Button>
						)}
					</>
				)}
			</div>
		</Card>
	);
}
