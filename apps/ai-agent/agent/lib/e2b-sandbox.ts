import type { Sandbox } from "@e2b/desktop";
import { connectDesktop, DESKTOP_TIMEOUT_MS } from "@repo/shared/desktop";
import { CommandExitError, NotFoundError } from "e2b";
import {
	defineSandboxProvider,
	SANDBOX_AGENT_ENV,
	type SandboxConnection,
	SandboxSessionGoneError,
} from "eve/sandbox/provider";
import { userDesktopId } from "./desktop";

const sh = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

// eve's bash and file tools run inside the user's one E2B desktop, the same machine
// the `computer` tool drives. This provider never creates a sandbox; the backend
// creates the desktop at sign-in (apps/backend/src/desktop.ts).
export const E2BSandbox = defineSandboxProvider({
	name: "e2b-desktop",
	environment(_options: object) {
		return {
			async prepare() {
				return {};
			},
			async start(ctx) {
				const { sandboxId } = await userDesktopId(ctx.session.auth.initiator);
				return {
					connection: connect(await connectDesktop(sandboxId)),
					state: { sandboxId },
				};
			},
			async resume(_ctx, _artifact, state) {
				try {
					return connect(await connectDesktop(state.sandboxId));
				} catch (error) {
					if (error instanceof NotFoundError)
						throw new SandboxSessionGoneError(
							`E2B desktop "${state.sandboxId}" is gone.`,
						);
					throw error;
				}
			},
			// The desktop belongs to the user, not to one chat: never delete it here.
			async onSessionEnd() {},
		};
	},
});

function connect(sandbox: Sandbox): SandboxConnection {
	// E2B does not count commands or file access as activity, so a chat that keeps
	// using the shell would hit the 5-minute auto-pause. Push the clock on every use.
	const touch = () => sandbox.setTimeout(DESKTOP_TIMEOUT_MS);
	return {
		// eve's default /workspace does not exist on E2B desktops and `user` can't create
		// it. Use the user's home (E2B docs: template/user-and-workdir), which always
		// exists and is where the desktop's file manager and terminal open.
		workspaceRoot: "/home/user",
		async spawn({ signal, command, env, workingDirectory, stdin }) {
			await touch();
			let out!: ReadableStreamDefaultController<Uint8Array>;
			let err!: ReadableStreamDefaultController<Uint8Array>;
			const enc = new TextEncoder();
			const stdout = new ReadableStream<Uint8Array>({
				start: (c) => {
					out = c;
				},
			});
			const stderr = new ReadableStream<Uint8Array>({
				start: (c) => {
					err = c;
				},
			});
			const handle = await sandbox.commands.run(`bash -lc ${sh(command)}`, {
				background: true,
				cwd: workingDirectory,
				envs: { ...SANDBOX_AGENT_ENV, ...env },
				stdin,
				timeoutMs: 0,
				retainOutput: false,
				onStdout: (d) => out.enqueue(enc.encode(d)),
				onStderr: (d) => err.enqueue(enc.encode(d)),
			});
			signal?.addEventListener("abort", () => void handle.kill(), {
				once: true,
			});
			const wait = handle.wait().then(
				() => ({ exitCode: 0 }),
				(e) => {
					if (e instanceof CommandExitError) return { exitCode: e.exitCode };
					throw e;
				},
			);
			const done = () =>
				wait
					.finally(() => {
						out.close();
						err.close();
					})
					.catch(() => {});
			void done();
			return {
				pid: handle.pid,
				stdin: stdin
					? new WritableStream<Uint8Array>({
							write: (chunk) => handle.sendStdin(chunk),
							close: () => handle.closeStdin(),
						})
					: undefined,
				stdout,
				stderr,
				wait: () => wait,
				kill: async () => void (await handle.kill()),
			};
		},
		async readFile({ path }) {
			await touch();
			try {
				return await sandbox.files.read(path, { format: "bytes" });
			} catch (error) {
				if (error instanceof NotFoundError) return null;
				throw error;
			}
		},
		async writeFiles({ files }) {
			await touch();
			await sandbox.files.write(
				files.map((f) => ({ path: f.path, data: f.content.slice().buffer })),
			);
		},
		async removePath({ path, force, recursive }) {
			await touch();
			const r = await sandbox.commands.run(
				`rm ${recursive ? "-r " : ""}${force ? "-f " : ""}-- ${sh(path)}`,
			);
			if (r.exitCode !== 0) throw new Error(r.stderr);
		},
		// The desktop belongs to the user and pauses itself when idle, so a chat
		// ending must not pause it under another chat.
		async stop() {},
	};
}
