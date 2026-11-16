import { create } from "zustand";

// Open/closed choices the person made on Steps blocks and rows, by id. Kept
// outside the components so they survive a remount (placeholder -> real message,
// reopening a chat). The conversation itself stays in eve's useEveAgent store.
const useStore = create<{ open: Record<string, boolean> }>(() => ({
	open: {},
}));

export function useManualOpen(key: string) {
	const value = useStore((s) => s.open[key]);
	const set = (o: boolean) =>
		useStore.setState((s) => ({ open: { ...s.open, [key]: o } }));
	return [value, set] as const;
}
