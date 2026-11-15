"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

// On every dashboard load, ask the backend to make sure this user has their one
// computer (it is created there, never by the agent). Safe to repeat, and it rebuilds
// a desktop E2B lost, so "reload the dashboard" really fixes a missing computer.
export function EnsureDesktop() {
	useEffect(() => {
		void api.api.me.desktop.$post();
	}, []);
	return null;
}
