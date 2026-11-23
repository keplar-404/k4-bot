// Each user's one cloud computer: an E2B desktop (template `k4-desktop`, built by
// scripts/computer-template.ts) shared by all their chats. Every agent (eve session)
// works as its own Linux user on its own desktop (scripts/k4-agent.sh), so agents
// never type into each other's windows. The user's own desktop is display :0.
// E2B is imported inside the functions, so code that never touches the computer
// (every normal chat turn) never loads the SDK.
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { userComputer } from "./schema";

export const COMPUTER_TEMPLATE = "k4-desktop";
// Idle time before E2B pauses the computer (free while paused). Every use resets it.
const IDLE_MS = 10 * 60_000;
// One websockify serves noVNC and every screen: a signed token (streamToken) names the
// VNC port it may open, so the browser connects to the computer directly.
const WEBSOCKIFY =
	"cd /opt/noVNC/utils/websockify && exec python3 -m websockify --web /opt/noVNC --token-plugin JWTTokenApi --token-source /etc/k4/stream-key 6080 > /tmp/websockify.log 2>&1";
// The computer's ports are public (E2B only takes its access token as a header, which
// an <iframe> can't send), so the computer closes them itself: from outside, only the
// stream (6080) and E2B's envd (49983, which has its own token) are reachable; Chrome's
// control ports and raw VNC are not. Loopback and replies stay open (E2B firewall docs).
const FIREWALL = [
	"iptables -F INPUT",
	"iptables -A INPUT -i lo -j ACCEPT",
	"iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
	"iptables -A INPUT -p tcp --dport 49983 -j ACCEPT",
	"iptables -A INPUT -p tcp --dport 6080 -j ACCEPT",
	"iptables -A INPUT -p tcp -j DROP",
].join(" && ");

// Agents' only root access: install Ubuntu packages by name. `apt-get install *` in
// sudoers also allowed `-o` options and local .debs, which run any command as root.
// sudo resets the environment, so only these names reach apt-get.
const K4_INSTALL = `#!/bin/bash
set -euo pipefail
[ $# -gt 0 ] || { echo "usage: sudo k4-install PKG..." >&2; exit 2; }
for p in "$@"; do [[ "$p" =~ ^[a-z0-9][a-z0-9+.-]+$ ]] || { echo "not a package name: $p" >&2; exit 2; }; done
apt-get update -qq
DEBIAN_FRONTEND=noninteractive exec apt-get install -y --no-install-recommends -- "$@"
`;
const SUDOERS = "%k4 ALL=(root) NOPASSWD: /usr/local/bin/k4-install\n";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// Fails when either file is missing or changed, so ensureStream rewrites both.
const LOCKED = `echo '${sha(K4_INSTALL)}  /usr/local/bin/k4-install' | sha256sum -c --status && echo '${sha(SUDOERS)}  /etc/sudoers.d/k4-agents' | sha256sum -c --status`;

type Desktop = import("@e2b/desktop").Sandbox;

/** The Linux user name of the agent working in an eve session. */
export const agentName = (sessionId: string) =>
	`a${createHash("sha256").update(sessionId).digest("hex").slice(0, 10)}`;

// The live view: x11vnc on the user's own desktop (agents' screens run their own,
// k4-agent.sh), websockify checking tokens, and the firewall. All survive pause and
// resume (memory snapshot); this redoes only what is missing. The VNC password file
// it writes is also the one every agent desktop copies.
/**
 * Starts XFCE again on a desktop whose session was logged out, as the E2B Desktop SDK's
 * startXfce4() does: a logout leaves `[xfce4-session] <defunct>`, which pgrep still
 * counts, so only a live (non-zombie) session counts here. The logged-out session's
 * window manager and desktop are cleared first, or the new session can't take the
 * screen and the mouse and keyboard stop working.
 */
async function ensureXfce(sbx: Desktop, user: string, display: string) {
	const alive = await sbx.commands
		.run(
			`ps -u ${user} -o stat=,comm= | grep -qE '^[^Z][^ ]* +xfce4-session$'`,
			{
				user: "root",
			},
		)
		.then(() => true)
		.catch(() => false);
	if (alive) return;
	await sbx.commands
		.run(
			`pkill -u ${user} -f '^(xfwm4|xfdesktop|xfce4-panel|xfsettingsd|Thunar)'`,
			{ user: "root" },
		)
		.catch(() => {});
	// Agents' sessions join their own D-Bus (.k4env, written by k4-agent).
	const start =
		user === "user"
			? "startxfce4"
			: `bash -c '. /home/${user}/.k4env; exec startxfce4'`;
	const run = await sbx.commands.run(
		`setsid ${start} </dev/null >/dev/null 2>&1`,
		{
			user,
			envs: { DISPLAY: display },
			background: true,
			timeoutMs: 0,
		},
	);
	await run.disconnect();
	await sbx.waitAndVerify(
		`pgrep -u ${user} -x xfwm4 >/dev/null && pgrep -u ${user} -x xfdesktop >/dev/null`,
		(r) => r.exitCode === 0,
		60,
	);
}

// Logging out of the user's desktop also ends its x11vnc, so the open live view would
// retry forever. This loop, on the computer, brings both back within seconds and
// noVNC's own reconnect picks them up. It survives pause and resume like the rest.
const KEEP = `while sleep 2; do
pgrep -u user -x x11vnc >/dev/null || x11vnc -bg -display :0 -forever -wait 50 -shared -rfbport 5900 -usepw 2>>/tmp/x11vnc_stderr.log
ps -u user -o stat=,comm= | grep -qE '^[^Z][^ ]* +xfce4-session$' || { pkill -u user -f '^(xfwm4|xfdesktop|xfce4-panel|xfsettingsd|Thunar)'; sleep 1; DISPLAY=:0 setsid startxfce4 </dev/null >/dev/null 2>&1 & sleep 10; }
done
`;

async function ensureStream(sbx: Desktop, password: string, streamKey: string) {
	// The Desktop SDK starts the user's X server only in create(); after a cold boot
	// (reboot above) it is gone. Same command as the SDK's _start.
	const x = await sbx.commands
		.run("xdpyinfo -display :0 >/dev/null")
		.then(() => true)
		.catch(() => false);
	if (!x) {
		await (
			await sbx.commands.run(
				"Xvfb :0 -ac -screen 0 1280x800x24 -retro -dpi 96 -nolisten tcp -nolisten unix",
				{ background: true, timeoutMs: 0 },
			)
		).disconnect();
		await sbx.waitAndVerify("xdpyinfo -display :0", (r) => r.exitCode === 0);
	}
	await ensureXfce(sbx, "user", ":0");
	const up = await sbx.commands
		.run(
			`pgrep -u user -x x11vnc >/dev/null && pgrep -fx 'bash /usr/local/bin/k4-keep' >/dev/null && pgrep -f '[t]oken-plugin JWTTokenApi' >/dev/null && iptables -C INPUT -p tcp -j DROP && ${LOCKED}`,
			{ user: "root" },
		)
		.then(() => true)
		.catch(() => false);
	if (up) return;
	await sbx.files.write("/etc/k4/stream-key", streamKey, { user: "root" });
	await sbx.files.write("/usr/local/bin/k4-install", K4_INSTALL, {
		user: "root",
	});
	await sbx.files.write("/etc/k4/sudoers", SUDOERS, { user: "root" });
	// A rule that fails visudo is removed, so agents lose sudo rather than keep the old one.
	await sbx.commands.run(
		`chmod 600 /etc/k4/stream-key && pkill -f '[n]ovnc_proxy'; pkill -f '[w]ebsockify'; ${FIREWALL} && chmod 755 /usr/local/bin/k4-install && chmod 440 /etc/k4/sudoers && { { visudo -cf /etc/k4/sudoers && mv /etc/k4/sudoers /etc/sudoers.d/k4-agents; } || rm -f /etc/sudoers.d/k4-agents; }`,
		{ user: "root" },
	);
	await sbx.commands.run(
		`mkdir -p ~/.vnc && x11vnc -storepasswd ${password} ~/.vnc/passwd >/dev/null 2>&1; pgrep -u user -x x11vnc >/dev/null || x11vnc -bg -display :0 -forever -wait 50 -shared -rfbport 5900 -usepw 2>/tmp/x11vnc_stderr.log`,
	);
	await sbx.files.write("/usr/local/bin/k4-keep", KEEP, { user: "root" });
	await sbx.commands.run("chmod 755 /usr/local/bin/k4-keep", { user: "root" });
	const keep = await sbx.commands.run(
		"pgrep -fx 'bash /usr/local/bin/k4-keep' >/dev/null || setsid bash /usr/local/bin/k4-keep </dev/null >/dev/null 2>&1",
		{ background: true, timeoutMs: 0 },
	);
	await keep.disconnect();
	await sbx.commands.run(WEBSOCKIFY, {
		user: "root",
		background: true,
		timeoutMs: 0,
	});
	await sbx.waitAndVerify(
		"netstat -tuln | grep ':6080 '",
		(r) => r.stdout.trim() !== "",
	);
}

/**
 * A short token for one screen's live view (VNC port 5900 for the user's desktop,
 * 5900+N for agent N). websockify checks it once, when the stream connects; noVNC's
 * reconnects reuse it, so it lasts 15 minutes.
 */
export async function streamToken(streamKey: string, vncPort: number) {
	const { SignJWT } = await import("jose");
	return new SignJWT({ host: "localhost", port: vncPort })
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime("15m")
		.sign(Buffer.from(streamKey, "base64url"));
}

async function create(db: Db, userId: string) {
	const { Sandbox } = await import("@e2b/desktop");
	const sbx = await Sandbox.create(COMPUTER_TEMPLATE, {
		resolution: [1280, 800],
		timeoutMs: IDLE_MS,
		lifecycle: { onTimeout: "pause", autoResume: true },
		// Public so the browser can stream directly; the computer's firewall and the
		// stream token are the locks (see FIREWALL).
		network: { allowPublicTraffic: true },
		metadata: { userId },
	});
	const streamPassword = randomBytes(12).toString("base64url");
	const streamKey = randomBytes(32).toString("base64url");
	const [row] = await db
		.insert(userComputer)
		.values({ userId, sandboxId: sbx.sandboxId, streamPassword, streamKey })
		.onConflictDoNothing()
		.returning();
	// Another request made this user's computer first: use theirs, drop ours.
	if (!row) {
		await sbx.kill().catch(() => {});
		return null;
	}
	return { sbx, streamPassword, streamKey };
}

/** The user's computer, resumed or created, with its live view and firewall up. */
export async function userDesktop(db: Db, userId: string) {
	const { Sandbox, NotFoundError, GuestUnresponsiveError } = await Promise.all([
		import("@e2b/desktop"),
		import("e2b"),
	]).then(([d, e]) => ({
		Sandbox: d.Sandbox,
		NotFoundError: e.NotFoundError,
		GuestUnresponsiveError: e.GuestUnresponsiveError,
	}));
	for (let attempt = 0; attempt < 3; attempt++) {
		const [row] = await db
			.select()
			.from(userComputer)
			.where(eq(userComputer.userId, userId));
		let got: {
			sbx: Desktop;
			streamPassword: string;
			streamKey: string;
		} | null = null;
		// Made before the direct stream: private, and no key. Replace it once.
		if (row && !row.streamKey) {
			const { Sandbox: Base } = await import("e2b");
			await Base.kill(row.sandboxId).catch(() => {});
			await db.delete(userComputer).where(eq(userComputer.userId, userId));
			continue;
		}
		if (row?.streamKey) {
			try {
				// connect resumes a paused computer and resets its idle timer. One paused while
				// hung can't resume its memory (E2B docs: resume-without-memory): cold-boot it
				// from disk instead. Files stay; open apps close, like a restarted computer.
				const sbx = await Sandbox.connect(row.sandboxId, {
					timeoutMs: IDLE_MS,
				}).catch((error) => {
					if (!(error instanceof GuestUnresponsiveError)) throw error;
					return Sandbox.connect(row.sandboxId, {
						timeoutMs: IDLE_MS,
						onResume: "reboot",
					});
				});
				got = {
					sbx,
					streamPassword: row.streamPassword,
					streamKey: row.streamKey,
				};
			} catch (error) {
				if (!(error instanceof NotFoundError)) throw error;
				// Deleted on E2B's side (e.g. from the console): start a new one.
				await db.delete(userComputer).where(eq(userComputer.userId, userId));
			}
		}
		got ??= await create(db, userId);
		if (!got) continue;
		await ensureStream(got.sbx, got.streamPassword, got.streamKey);
		return got;
	}
	throw new Error("Could not start the computer.");
}

/**
 * The display number of a session's agent desktop, or null when that agent hasn't
 * used the computer (or gave its slot to a newer agent). Starts nothing.
 */
export async function agentDisplay(sbx: Desktop, sessionId: string) {
	const r = await sbx.commands
		.run(`k4-agent --peek ${agentName(sessionId)}`, { user: "root" })
		.catch(() => null);
	const n = Number(r?.stdout.trim());
	if (!r?.stdout.trim() || !Number.isInteger(n)) return null;
	// Restart whatever stopped, so the live view never points at a dead port: k4-agent
	// brings back the screen, x11vnc, Chrome and Cua Driver; ensureXfce the desktop after
	// a logout. Quick when everything is already up.
	const name = agentName(sessionId);
	await sbx.commands
		.run(`k4-agent ${name}`, { user: "root", timeoutMs: 90_000 })
		.catch(() => {});
	await ensureXfce(sbx, name, `:${n}`).catch(() => {});
	return n;
}

const tail = (s: string, max: number) =>
	s.length > max ? `…(earlier output trimmed)\n${s.slice(-max)}` : s;

// A computer this process connected to recently, per user, and when each agent's
// desktop was last confirmed. Reused for FRESH_MS, so a burst of tool calls costs one
// write and one run each instead of a database read, a connect and two checks.
// Capped at MAX_WARM users (oldest dropped). Reconnecting (userDesktop) also resets
// the computer's idle timer, which a warm call skips: FRESH_MS is far below IDLE_MS.
const FRESH_MS = 60_000;
const MAX_WARM = 50;
const warm = new Map<
	string,
	{ sbx: Desktop; at: number; agents: Map<string, number> }
>();

async function warmDesktop(db: Db, userId: string) {
	const now = Date.now();
	const hit = warm.get(userId);
	if (hit && now - hit.at < FRESH_MS) return hit;
	const { sbx } = await userDesktop(db, userId);
	const entry = {
		sbx,
		at: now,
		agents: hit?.agents ?? new Map<string, number>(),
	};
	warm.delete(userId);
	if (warm.size >= MAX_WARM) {
		const oldest = warm.keys().next().value;
		if (oldest !== undefined) warm.delete(oldest);
	}
	warm.set(userId, entry);
	return entry;
}

/**
 * Runs a shell command as a session's agent, on its own desktop (started on first
 * use). Cua Driver and the Browser Use harness are on its PATH, set up for that
 * desktop. A failing command comes back as output, so the agent can read and retry.
 */
export async function runOnComputer(
	db: Db,
	userId: string,
	sessionId: string,
	command: string,
	opts: { timeoutMs?: number; signal?: AbortSignal; stdin?: string } = {},
) {
	const { CommandExitError } = await import("e2b");
	const name = agentName(sessionId);
	const result = (r: { exitCode: number; stdout: string; stderr: string }) => ({
		exitCode: r.exitCode,
		stdout: tail(r.stdout, 12_000),
		stderr: tail(r.stderr, 4_000),
	});
	for (let attempt = 0; ; attempt++) {
		// Command and input in one file, run as the agent itself: one write, one run, no
		// shell quoting. The input goes in as a heredoc with a random end marker.
		const id = crypto.randomUUID().replaceAll("-", "");
		const path = `/tmp/k4-${id}.sh`;
		const script = `. /home/${name}/.k4env\n{\n${command}\n} <<'K4_${id}'\n${opts.stdin ?? ""}\nK4_${id}\n`;
		const w = await warmDesktop(db, userId);
		try {
			if ((w.agents.get(name) ?? 0) < Date.now() - FRESH_MS) {
				await w.sbx.commands.run(`k4-agent ${name}`, {
					user: "root",
					timeoutMs: 120_000,
				});
				w.agents.set(name, Date.now());
			}
			await w.sbx.files.write(path, script, { user: name });
			return result(
				await w.sbx.commands.run(`bash ${path}; s=$?; rm -f ${path}; exit $s`, {
					user: name,
					// E2B starts in the default user's home otherwise, which agents may not enter.
					cwd: `/home/${name}`,
					timeoutMs: opts.timeoutMs ?? 120_000,
					signal: opts.signal,
				}),
			);
		} catch (error) {
			if (error instanceof CommandExitError) return result(error);
			// The computer paused, was replaced, or the connection broke: start over once.
			warm.delete(userId);
			if (attempt > 0 || opts.signal?.aborted) throw error;
		}
	}
}

/** Whether the user's computer is on right now. Only asks E2B: never resumes it. */
export async function computerOn(db: Db, userId: string) {
	const [row] = await db
		.select({ sandboxId: userComputer.sandboxId })
		.from(userComputer)
		.where(eq(userComputer.userId, userId));
	if (!row) return false;
	const { Sandbox } = await import("e2b");
	const info = await Sandbox.getInfo(row.sandboxId).catch(() => null);
	return info?.state === "running";
}

/**
 * Pauses the user's computer now: billing stops, and files, apps, logins and open
 * windows are kept. Any later use (the panel or an agent) resumes it. False when the
 * user has no computer.
 */
export async function pauseComputer(db: Db, userId: string) {
	const [row] = await db
		.select({ sandboxId: userComputer.sandboxId })
		.from(userComputer)
		.where(eq(userComputer.userId, userId));
	if (!row) return false;
	const { Sandbox, ServiceBusyError } = await import("e2b");
	// E2B can refuse a pause for a moment with 503 ServiceBusyError: retry.
	for (let attempt = 1; ; attempt++) {
		try {
			await Sandbox.pause(row.sandboxId);
			return true;
		} catch (error) {
			if (!(error instanceof ServiceBusyError) || attempt === 3) throw error;
			await new Promise((r) => setTimeout(r, 1000 * attempt));
		}
	}
}
