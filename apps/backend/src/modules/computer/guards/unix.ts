import { type Checked, fail } from "./checked";

/** Single-quote a value for POSIX shells. The only way untrusted text may enter a command line. */
export const shellQuote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Linux account per bot. Its home directory is mode 700, so one bot's shell
 * cannot read another bot's files even though they share a machine.
 * Valid username: starts with a letter, 26 chars, derived only from a UUID.
 */
export function botUnixUser(botId: string): Checked<string> {
  if (!UUID.test(botId)) return fail("Invalid bot id.");
  return { ok: true, value: `u_${botId.replaceAll("-", "").slice(0, 24).toLowerCase()}` };
}

export const botHome = (unixUser: string) => `/home/${unixUser}`;

