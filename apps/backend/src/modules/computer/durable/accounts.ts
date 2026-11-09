import type { Sandbox } from "@e2b/desktop";
import { botHome, botUnixUser, shellQuote } from "../guards";
import { BOT_MAX_PROCESSES, STAGE_DIR } from "./constants";
import type { ComputerTables } from "./tables";

/**
 * Creates the bot's own Linux account if needed. Its home is 755: every bot may READ every other bot's files, but
 * only the owner can write, rename or delete them (the kernel enforces that, not the prompt). The browser profile
 * (cookies, logins) stays 700, private to the bot.
 */
export async function ensureAccount(sbx: Sandbox, user: string) {
  const home = botHome(user);
  await sbx.commands.run(
    `id -u ${user} >/dev/null 2>&1 || useradd -m -s /bin/bash -K UMASK=022 ${user}; chmod 755 ${home}; install -d -m 700 -o ${user} -g ${user} ${home}/.chrome; ` +
      // Staging for file uploads: bots may pass through (to their own staged file), never list it.
      `install -d -m 711 -o root -g root ${STAGE_DIR}`,
    { user: "root" },
  );
}

export async function runAs(sbx: Sandbox, user: string, command: string, timeoutMs = 120_000, background = false) {
  const home = botHome(user);
  // umask 022: what a bot creates is readable (never writable) by the other bots.
  // ulimit -u: a hard cap on the bot's processes and threads (a fork bomb cannot take the computer down;
  // a non-root process can lower it but never raise it again). Chrome alone uses a few hundred threads.
  return sbx.commands.run(`ulimit -u ${BOT_MAX_PROCESSES} 2>/dev/null; umask 022; ${command}`, {
    user,
    cwd: home,
    envs: { HOME: home, DISPLAY: sbx.display, LANG: "C.UTF-8" },
    timeoutMs,
    ...(background ? { background: true as const } : {}),
  });
}

/** /home/BOTS.md (root-owned, read-only): which folder is which bot, so bots can find each other's files. */
export async function writeDirectory(sbx: Sandbox, tables: ComputerTables) {
  const lines = tables.botNames().flatMap((r) => {
    const user = botUnixUser(r.bot_id);
    return user.ok ? [`- ${r.name.replace(/[\r\n]+/g, " ")}: ${botHome(user.value)}`] : [];
  });
  const text = `# Bots on this computer\nEvery bot can read these folders. Only a folder's own bot can change or delete its files.\n\n${lines.join("\n")}\n`;
  await sbx.files.write("/home/BOTS.md", text, { user: "root" });
}

/** Removes the accounts of deleted bots. Returns how many were purged. */
export async function purgeAccounts(sbx: Sandbox, tables: ComputerTables, botUsers: Set<string>): Promise<number> {
  const pending = tables.pendingPurges();
  for (const { bot_id } of pending) {
    const user = botUnixUser(bot_id);
    if (user.ok) {
      // Stop everything it runs (its browser too), delete what it left in the shared temp folders (by owner,
      // so nobody else's files), then the account with its home (files, browser profile and all).
      await sbx.commands.run(
        `pkill -KILL -u ${user.value}; find /tmp /var/tmp /dev/shm -xdev -user ${user.value} -delete 2>/dev/null; userdel -r -f ${user.value} 2>/dev/null; true`,
        { user: "root", timeoutMs: 120_000 },
      );
      botUsers.delete(user.value);
    }
    tables.markPurged(bot_id);
  }
  return pending.length;
}

/** Composio ids are like "ca_AbC123": nothing else may reach the shell or a path. */
export const APP_ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Where a bot's browser keeps its logins for one connected app account (see openInBrowser). */
export const appProfileDir = (user: string, toolkit: string, accountId: string) => `${botHome(user)}/.k4/profiles/${toolkit}/${accountId}`;

/** Deletes every bot's browser logins for disconnected app accounts, closing the browsers that use them first. */
export async function wipeAppProfiles(sbx: Sandbox, tables: ComputerTables) {
  for (const id of tables.pendingProfileWipes()) {
    if (APP_ACCOUNT_ID.test(id)) {
      await sbx.commands.run(
        `pkill -KILL -f ${shellQuote(`user-data-dir=/home/[^ ]*/\\.k4/profiles/[^/ ]*/${id}( |$)`)}; rm -rf /home/*/.k4/profiles/*/${shellQuote(id)}; true`,
        { user: "root", timeoutMs: 60_000 },
      );
    }
    tables.profileWiped(id);
  }
}
