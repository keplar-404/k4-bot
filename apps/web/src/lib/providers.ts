"use client";

// The user's own model providers (Settings > Model providers): every provider, which
// ones have a key, and the connected ones' models for the picker. Loaded once per page
// load; changeProviders() after a key is added or removed reloads every user of it.
import { findModel, type ModelOption } from "@repo/shared/models";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type Field = {
	name: string;
	label: string;
	type: "secret" | "json" | "text" | "list" | "number";
	optional?: true;
	placeholder?: string;
};
export type Provider = {
	id: string;
	name: string;
	kind: "key" | "template" | "bedrock" | "vertex" | "azure" | "custom";
	doc: string | null;
	models: number;
	fields: Field[];
	/** What's saved: plain settings and a hint of the key. Secrets never come back. */
	saved: {
		hint: string;
		config: Record<string, string | number | string[]>;
	} | null;
};
type State = { providers: Provider[]; models: ModelOption[] };

const EVENT = "k4:providers-changed";
let loaded: Promise<State> | undefined;
export const getProviders = () => {
	loaded ??= api.api.me.providers
		.$get()
		.then(async (r) =>
			r.ok ? ((await r.json()) as State) : { providers: [], models: [] },
		)
		.catch(() => ({ providers: [], models: [] }));
	return loaded;
};
export const changeProviders = () => {
	loaded = undefined;
	window.dispatchEvent(new Event(EVENT));
};

/** The connected providers' models, kept fresh across changes in Settings. */
export function useOwnModels() {
	const [models, setModels] = useState<ModelOption[]>([]);
	useEffect(() => {
		const load = () => void getProviders().then((s) => setModels(s.models));
		load();
		window.addEventListener(EVENT, load);
		return () => window.removeEventListener(EVENT, load);
	}, []);
	return models;
}

/** A built-in model, or one of the user's own (`byok:` ids). */
export const modelIn = (own: ModelOption[], id: string) =>
	own.find((m) => m.id === id) ?? findModel(id);
