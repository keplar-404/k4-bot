import { create } from "zustand";

// Open/closed choices the person made on Steps blocks and rows, by id. Kept
// outside the components so they survive a remount (placeholder -> real message,
// reopening a chat). The conversation itself stays in eve's useEveAgent store.
const useStore = create<{
	open: Record<string, boolean>;
	memoryBusy: boolean;
	computerBusy: boolean;
	computerSession: string | undefined;
}>(() => ({
	open: {},
	memoryBusy: false,
	computerBusy: false,
	computerSession: undefined,
}));

export function useManualOpen(key: string) {
	const value = useStore((s) => s.open[key]);
	const set = (o: boolean) =>
		useStore.setState((s) => ({ open: { ...s.open, [key]: o } }));
	return [value, set] as const;
}

// True while the agent's memory tools (profile__update) run in this
// tab's chat. Settings > Memory locks editing meanwhile, so a save can't overwrite them.
// shortcut: only sees this tab's chat; check on the server if users edit from many tabs.
export const useMemoryBusy = () => useStore((s) => s.memoryBusy);
export const setMemoryBusy = (memoryBusy: boolean) =>
	useStore.setState({ memoryBusy });

// True while this tab's chat runs a computer_* tool: the dashboard opens the
// Computer panel so the user sees the agent work.
export const useComputerBusy = () => useStore((s) => s.computerBusy);
export const setComputerBusy = (computerBusy: boolean) =>
	useStore.setState({ computerBusy });

// The open chat's eve session: the Computer panel shows that chat's agent desktop.
export const useComputerSession = () => useStore((s) => s.computerSession);
export const setComputerSession = (computerSession: string | undefined) =>
	useStore.setState({ computerSession });
