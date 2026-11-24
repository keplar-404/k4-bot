"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// One highlight that glides to the hovered (or keyboard-focused) item of its parent,
// like the prompt bar's @ menu. Drop it in as a child of any list: it marks the parent
// `data-glide`, and globals.css turns the items' own hover background off there.
// The parent gets `isolation: isolate`, so the highlight (z -1) sits under the items.
export function Glide({
	items,
	className,
}: {
	/** CSS selector for the items to follow. */
	items: string;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	// `jump`: first show after hiding, so it fades in in place instead of sliding.
	const [g, setG] = useState<{
		box?: { top: number; left: number; width: number; height: number };
		shown: boolean;
		jump: boolean;
	}>({ shown: false, jump: true });
	useEffect(() => {
		const host = ref.current?.parentElement;
		if (!host) return;
		host.setAttribute("data-glide", "");
		host.style.isolation = "isolate";
		if (getComputedStyle(host).position === "static")
			host.style.position = "relative";
		const to = (target: EventTarget | null) => {
			const el = (target as Element | null)?.closest?.(items);
			if (!el || !host.contains(el)) return;
			const h = host.getBoundingClientRect();
			const r = el.getBoundingClientRect();
			const box = {
				top: r.top - h.top + host.scrollTop - host.clientTop,
				left: r.left - h.left + host.scrollLeft - host.clientLeft,
				width: r.width,
				height: r.height,
			};
			setG((p) => ({ box, shown: true, jump: !p.shown }));
		};
		const over = (e: Event) => to(e.target);
		const focus = (e: Event) => {
			if ((e.target as Element).matches?.(":focus-visible")) to(e.target);
		};
		// Stays on an item whose submenu is open, and while the pointer is still here.
		const leave = () => {
			if (!host.querySelector("[data-popup-open]"))
				setG((p) => ({ ...p, shown: false }));
		};
		const blur = () => {
			if (!host.matches(":hover")) leave();
		};
		host.addEventListener("pointerover", over);
		host.addEventListener("focusin", focus);
		host.addEventListener("pointerleave", leave);
		host.addEventListener("focusout", blur);
		return () => {
			host.removeEventListener("pointerover", over);
			host.removeEventListener("focusin", focus);
			host.removeEventListener("pointerleave", leave);
			host.removeEventListener("focusout", blur);
		};
	}, [items]);
	return (
		<span
			ref={ref}
			aria-hidden
			className={cn(
				"pointer-events-none absolute -z-10 rounded-md bg-accent duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
				g.jump
					? "transition-opacity"
					: "transition-[top,left,width,height,opacity]",
				className,
			)}
			style={{ ...g.box, opacity: g.shown ? 1 : 0 }}
		/>
	);
}
