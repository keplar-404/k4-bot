"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

// Once per browser session, ask the backend to make sure this user has their one
// computer (it is created there, never by the agent). Safe to repeat.
export function EnsureDesktop() {
	useEffect(() => {
		if (sessionStorage.getItem("desktop-ready")) return;
		void api.api.me.desktop.$post().then((res) => {
			if (res.ok) sessionStorage.setItem("desktop-ready", "1");
		});
	}, []);
	return null;
}
