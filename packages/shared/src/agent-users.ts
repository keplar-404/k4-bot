// Removes the Linux users (k4-agent.sh) of chats that no longer exist: the chat's own
// agent and every helper it started (eve child sessions, saved as `child.opened` rows
// in agent_event). Only the user's home goes: shared apps, /home/shared and the shared
// logins (/home/shared/.k4/cookies.json) stay.
// - Deleting a chat removes its users at once if the computer is on (removeChatUsers).
//   A paused computer is never woken for this: the sweep removes them on its next start.
// - The sweep (sweepAgentUsers, from userDesktop) removes every agent user whose session
//   belongs to no chat. Users used in the last GRACE_MIN minutes are kept (a new chat
//   saves its session id a moment after it starts), and so is a user running a command.
import { sql } from "drizzle-orm";
import { agentName, computerOn } from "./computer";
import type { Db } from "./db";
import { userComputer } from "./schema";

type Desktop = import("@e2b/desktop").Sandbox;

const GRACE_MIN = 30;
const NAME = /^a[0-9a-f]{10}$/;

// Root script. $1: grace minutes (0 = none); then the names to remove, or none to
// consider every agent user on the computer except those listed in /tmp/k4-keep.
// Takes k4-agent.sh's lock, so no desktop starts for a user while it goes.
const REMOVE = `set -u
grace=$1; shift
state=/var/lib/k4
mkdir -p "$state"; exec 9>"$state/.lock"; flock 9
if [ $# -gt 0 ]; then names="$*"; else
  names=$(getent passwd | cut -d: -f1 | grep -xE 'a[0-9a-f]{10}' | grep -vxF -f /tmp/k4-keep || true)
fi
for u in $names; do
  [[ "$u" =~ ^a[0-9a-f]{10}$ ]] || continue
  id -u "$u" >/dev/null 2>&1 || { rm -f "$state/$u"; continue; }
  pgrep -u "$u" -f '^bash /tmp/k4-' >/dev/null && { echo "busy $u"; continue; }
  if [ "$grace" -gt 0 ]; then
    recent=$(find "$state/$u" "/home/$u" -maxdepth 0 -mmin -"$grace" 2>/dev/null)
    [ -n "$recent" ] && { echo "recent $u"; continue; }
  fi
  n=$(cat "$state/$u" 2>/dev/null || true)
  pkill -u "$u"; sleep 0.5; pkill -9 -u "$u"; sleep 0.2
  [ -n "$n" ] && rm -f "/tmp/.X11-unix/X$n" "/tmp/.X$n-lock"
  rm -f "$state/$u"
  userdel -r "$u" >/dev/null 2>&1 || userdel -rf "$u" >/dev/null 2>&1
  echo "removed $u"
done
`;

async function run(
	sbx: Desktop,
	grace: number,
	names: string[],
	keep?: string[],
) {
	if (keep)
		await sbx.files.write("/tmp/k4-keep", `${keep.join("\n")}\n`, {
			user: "root",
		});
	await sbx.files.write("/tmp/k4-remove.sh", REMOVE, { user: "root" });
	const r = await sbx.commands.run(
		`bash /tmp/k4-remove.sh ${grace} ${names.filter((n) => NAME.test(n)).join(" ")}`,
		{ user: "root", timeoutMs: 60_000 },
	);
	return r.stdout.trim();
}

// neon-serverless returns { rows }, neon-http the rows themselves.
const idsOf = (r: unknown): string[] =>
	((r as { rows?: { id: string }[] }).rows ?? (r as { id: string }[])).map(
		(x) => x.id,
	);

/** A session and every helper session under it (helpers of helpers too). */
export async function sessionTree(db: Db, userId: string, sessionId: string) {
	const rows = await db.execute<{ id: string }>(sql`
		with recursive tree(id) as (
			select ${sessionId}::text
			union
			select e.data->>'sessionId' from agent_event e join tree t on e.session_id = t.id
			where e.user_id = ${userId} and e.type = 'child.opened' and e.data->>'sessionId' is not null
		)
		select id from tree`);
	return idsOf(rows);
}

/** Removes these sessions' Linux users now if the computer is on; else the sweep will. */
export async function removeChatUsers(
	db: Db,
	userId: string,
	sessionIds: string[],
) {
	if (sessionIds.length === 0 || !(await computerOn(db, userId))) return "";
	const [row] = await db
		.select({ sandboxId: userComputer.sandboxId })
		.from(userComputer)
		.where(sql`${userComputer.userId} = ${userId}`);
	if (!row) return "";
	const { Sandbox } = await import("@e2b/desktop");
	const sbx = await Sandbox.connect(row.sandboxId);
	return run(sbx, 0, sessionIds.map(agentName));
}

/** Removes agent users whose session belongs to none of the user's chats. */
export async function sweepAgentUsers(db: Db, userId: string, sbx: Desktop) {
	const rows = await db.execute<{ id: string }>(sql`
		with recursive tree(id) as (
			select eve_session_id from chat where user_id = ${userId} and eve_session_id is not null
			union
			select e.data->>'sessionId' from agent_event e join tree t on e.session_id = t.id
			where e.user_id = ${userId} and e.type = 'child.opened' and e.data->>'sessionId' is not null
		)
		select id from tree`);
	return run(sbx, GRACE_MIN, [], idsOf(rows).map(agentName));
}

// Once per process per user per hour: the sweep is one query and one command.
const swept = new Map<string, number>();
export function maybeSweep(db: Db, userId: string, sbx: Desktop) {
	const now = Date.now();
	if (now - (swept.get(userId) ?? 0) < 60 * 60_000) return;
	swept.set(userId, now);
	void sweepAgentUsers(db, userId, sbx).catch((error) =>
		console.error("agent user sweep failed", error),
	);
}
