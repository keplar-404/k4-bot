import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bot } from "../../../db/schema";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { getRequestContext } from "../../../shared/context";
import { botUnixUser } from "../guards";
import { computerFor } from "../sandbox-backend";

/**
 * GET /computer/accounts: the Linux accounts on the user's computer. Every bot has its own (u_<id>, home folder
 * private to that bot). Bots come from the database; sizes come from the machine when it is running (`null` when
 * asleep: it is never woken to answer). An account whose bot no longer exists is listed as an orphan.
 */
const accounts = new Hono<AuthGuardEnv>().get("/accounts", async (c) => {
  const { db, env } = getRequestContext(c);
  const userId = c.get("session").user.id;
  const [bots, onDisk] = await Promise.all([
    db.select({ id: bot.id, name: bot.name }).from(bot).where(eq(bot.userId, userId)),
    computerFor(env, userId)
      .accountsOnDisk()
      .catch(() => null),
  ]);
  const disk = new Map((onDisk ?? []).map((a) => [a.user, a.kb]));
  const items = bots.map((b) => {
    const checked = botUnixUser(b.id);
    const user = checked.ok ? checked.value : "";
    return { botId: b.id, botName: b.name, user, home: `/home/${user}`, exists: onDisk ? disk.has(user) : null, kb: disk.get(user) ?? null };
  });
  const known = new Set(items.map((i) => i.user));
  const orphans = (onDisk ?? []).filter((a) => !known.has(a.user)).map((a) => ({ user: a.user, kb: a.kb }));
  return c.json({ running: onDisk !== null, items, orphans });
});

export default accounts;
