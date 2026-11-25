"use client";

// Right panel > File. Images: the browser's <img> (HEIC converted by heic-to).
// Everything else: react-doc-viewer's Quick Start, header off
// (docs: npmjs.com/package/@iamjariwala/react-doc-viewer). PDF uses its react-pdf renderer.
import DocViewer, { DocViewerRenderers } from "@iamjariwala/react-doc-viewer";
import "@iamjariwala/react-doc-viewer/dist/index.css";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ViewFile } from "@/lib/chat-ui";

export default function FileViewer({ file }: { file: ViewFile }) {
	// undefined: loading; null: the link could not be made.
	const [url, setUrl] = useState<string | null>();
	useEffect(() => {
		let shown: string | undefined;
		api.api.files
			.$get({ query: { key: file.key, inline: "1" } })
			.then(async (r) => (r.ok ? (await r.json()).url : null))
			.then(async (link) => {
				if (!link || !file.type?.startsWith("image/hei")) return link;
				// Chrome and Firefox can't show HEIC (docs: npmjs.com/package/heic-to).
				const { heicTo } = await import("heic-to");
				const blob = await (await fetch(link)).blob();
				shown = URL.createObjectURL(await heicTo({ blob, type: "image/jpeg" }));
				return shown;
			})
			.catch(() => null)
			.then(setUrl);
		return () => {
			if (shown) URL.revokeObjectURL(shown);
		};
	}, [file.key, file.type]);

	if (url === undefined)
		return <p className="p-4 text-muted-foreground">Loading…</p>;
	if (url === null)
		return <p className="p-4 text-destructive">Could not open the file.</p>;
	if (file.type?.startsWith("image/"))
		return (
			// biome-ignore lint/performance/noImgElement: a signed R2 link, not a static asset
			<img src={url} alt={file.name} className="m-auto max-h-full max-w-full" />
		);
	if (/^(audio|video)\//.test(file.type ?? ""))
		return (
			// biome-ignore lint/a11y/useMediaCaption: user and generated media, no captions exist
			<video src={url} controls className="m-auto max-h-full max-w-full" />
		);
	return (
		<DocViewer
			documents={[{ uri: url, fileType: file.type, fileName: file.name }]}
			pluginRenderers={DocViewerRenderers}
			prefetchMethod="GET"
			config={{ header: { disableHeader: true } }}
			// docs (Styling): .rdv-pdf-controls is the zoom/page bar; preview only.
			className="[&_.rdv-pdf-controls]:hidden!"
			style={{ height: "100%", width: "100%" }}
		/>
	);
}
