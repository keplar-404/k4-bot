// Per-user Linux desktop on E2B Desktop. The backend creates it (at sign-in);
// the agent only resumes it.
// Docs: docs.e2b.dev/sandbox/persistence (auto-pause), /sandbox/connect (resume),
// /use-cases/computer-use (stream), /agents/openai-computer-use#watch-live (requireAuth).
import type { Sandbox } from "@e2b/desktop";

const RESOLUTION: [number, number] = [1280, 800];
// Pauses (memory + disk kept) after 5 min without use; each use restarts the timer.
export const DESKTOP_TIMEOUT_MS = 5 * 60 * 1000;

/** True while E2B still has this desktop (running or paused). */
export async function desktopExists(sandboxId: string): Promise<boolean> {
	const { Sandbox } = await import("@e2b/desktop");
	try {
		await Sandbox.getInfo(sandboxId);
		return true;
	} catch (error) {
		if (/NotFoundError$/.test((error as Error).name)) return false; // SandboxNotFoundError
		throw error;
	}
}

/** Create a desktop for a new user and pause it right away. Returns its sandbox id. */
export async function createUserDesktop(userId: string): Promise<string> {
	const { Sandbox } = await import("@e2b/desktop");
	const desktop = await Sandbox.create({
		resolution: RESOLUTION,
		timeoutMs: DESKTOP_TIMEOUT_MS,
		lifecycle: { onTimeout: "pause" },
		metadata: { userId },
	});
	await desktop.pause();
	return desktop.sandboxId;
}

/** Resume a user's paused desktop and start a password-protected, view-only stream. */
export async function openUserDesktop(
	sandboxId: string,
): Promise<{ desktop: Sandbox; streamUrl: string }> {
	const { Sandbox } = await import("@e2b/desktop");
	// connect() resumes a paused sandbox.
	const desktop = await Sandbox.connect(sandboxId);
	await desktop.setTimeout(DESKTOP_TIMEOUT_MS);
	// A resumed desktop is often still streaming from the last run, and only the
	// instance that started a stream knows its password. Restart it, so this instance
	// owns the key (start() alone throws "already running", then getAuthKey() fails).
	await desktop.stream.stop().catch(() => {});
	await desktop.stream.start({ requireAuth: true });
	const streamUrl = desktop.stream.getUrl({
		viewOnly: true,
		authKey: desktop.stream.getAuthKey(),
	});
	return { desktop, streamUrl };
}
