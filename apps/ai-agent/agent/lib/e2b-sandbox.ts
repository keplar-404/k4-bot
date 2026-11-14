import { createHash } from "node:crypto";
import { CommandExitError, NotFoundError, Sandbox } from "e2b";
import {
	defineSandboxProvider,
	SANDBOX_AGENT_ENV,
	type SandboxConnection,
	SandboxSessionGoneError,
} from "eve/sandbox/provider";

const TIMEOUT_MS = 30 * 60 * 1000;
const sh = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;
const keyFor = (sessionId: string) =>
	createHash("sha256").update(sessionId).digest("hex").slice(0, 32);

export const E2BSandbox = defineSandboxProvider({
	name: "e2b",
	environment(options: { readonly template?: string }) {
		// shortcut: no template snapshot, workspace/skill seed files are not baked in; upgrade via ctx.populate()
		const connectTo = (sandbox: Sandbox) => connect(sandbox);
		return {
			async prepare() {
				return {};
			},
			async start(
				ctx,
				open: { readonly egress?: "allow-all" | "deny-all" } | undefined,
			) {
				const key = keyFor(ctx.session.id);
				const [existing] = await Sandbox.list({
					query: { metadata: { eveSession: key } },
				}).nextItems();
				if (existing) {
					const sandbox = await Sandbox.connect(existing.sandboxId);
					return {
						connection: connectTo(sandbox),
						state: { sandboxId: sandbox.sandboxId, key },
					};
				}
				const sandbox = await Sandbox.create(options.template ?? "base", {
					metadata: { eveSession: key },
					envs: SANDBOX_AGENT_ENV,
					timeoutMs: TIMEOUT_MS,
					lifecycle: { onTimeout: "pause", autoResume: true },
					allowInternetAccess: open?.egress !== "deny-all",
				});
				await sandbox.commands.run(
					"sudo mkdir -p /workspace && sudo chown $(id -u):$(id -g) /workspace",
				);
				return {
					connection: connectTo(sandbox),
					state: { sandboxId: sandbox.sandboxId, key },
				};
			},
			async resume(_ctx, _artifact, state) {
				try {
					return connectTo(await Sandbox.connect(state.sandboxId));
				} catch (error) {
					if (error instanceof NotFoundError)
						throw new SandboxSessionGoneError(
							`E2B sandbox "${state.sandboxId}" is gone.`,
						);
					throw error;
				}
			},
			async onSessionEnd(ctx, state) {
				const id =
					state?.sandboxId ??
					(
						await Sandbox.list({
							query: { metadata: { eveSession: keyFor(ctx.session.id) } },
						}).nextItems()
					)[0]?.sandboxId;
				if (id) await Sandbox.kill(id); // returns false when already gone
			},
		};
	},
});

function connect(sandbox: Sandbox): SandboxConnection {
	return {
		async spawn({ signal, command, env, workingDirectory, stdin }) {
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
			try {
				return await sandbox.files.read(path, { format: "bytes" });
			} catch (error) {
				if (error instanceof NotFoundError) return null;
				throw error;
			}
		},
		async writeFiles({ files }) {
			await sandbox.files.write(
				files.map((f) => ({ path: f.path, data: f.content.slice().buffer })),
			);
		},
		async removePath({ path, force, recursive }) {
			const r = await sandbox.commands.run(
				`rm ${recursive ? "-r " : ""}${force ? "-f " : ""}-- ${sh(path)}`,
			);
			if (r.exitCode !== 0) throw new Error(r.stderr);
		},
		async stop() {
			await sandbox.pause();
		},
	};
}
