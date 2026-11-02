/**
 * Deterministic guardrails for the computer. Pure functions, no I/O.
 *
 * LangChain's guardrails guide distinguishes deterministic checks (cheap,
 * predictable) from model-based ones (slower, costly). Everything a prompt
 * injection could abuse for free (URLs, key names, typed secrets, shell
 * quoting) is checked here, before it reaches the VM.
 */

export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

/** Single-quote a value for POSIX shells. The only way untrusted text may enter a command line. */
export const shellQuote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^(22[4-9]|2[3-5]\d)\./, // multicast + reserved
];

/** CIDRs the VM may never reach: the cloud metadata service and every private network. Also enforced by E2B's firewall. */
export const DENY_OUT = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "127.0.0.0/8", "100.64.0.0/10"];

/**
 * http(s) only, public hosts only, no credentials in the URL. `new URL` already
 * canonicalises decimal/hex/octal IPv4 tricks (http://2130706433 -> 127.0.0.1),
 * so the private-range check below sees the real address.
 */
export function checkUrl(input: string, allowedHosts: string[] = []): Checked<string> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return fail("That is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return fail("Only http and https URLs are allowed.");
  if (url.username || url.password) return fail("URLs with embedded credentials are not allowed.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[")) return fail("IPv6 address literals are not allowed.");
  if (!host.includes(".") || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host)) {
    return fail("Internal hostnames are not allowed.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.some((re) => re.test(host))) {
    return fail("Private and reserved network addresses are not allowed.");
  }
  if (allowedHosts.length > 0 && !allowedHosts.some((a) => host === a || host.endsWith(`.${a}`))) {
    return fail(`Only these sites are allowed: ${allowedHosts.join(", ")}.`);
  }
  return { ok: true, value: url.toString() };
}

/** xdotool key names ("ctrl+l", "Return", "alt+Left"), optionally a short sequence. Charset-restricted so it can never be shell syntax. */
export function checkKeys(input: string): Checked<string[]> {
  const parts = input.trim().split(/\s+/);
  if (parts.length > 8) return fail("At most 8 keys per call.");
  if (!parts.every((p) => /^[A-Za-z0-9_+\-]{1,40}$/.test(p))) return fail("Invalid key name.");
  return { ok: true, value: parts };
}

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1 && (n *= 2) > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}/, // OpenAI / OpenRouter style keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{30,}/, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/** True for payment-card numbers and well-known key formats. The agent must never type these; it asks the user to take over instead. */
export function looksLikeSecret(text: string): boolean {
  if (SECRET_PATTERNS.some((re) => re.test(text))) return true;
  for (const run of text.match(/\d[\d -]{11,22}\d/g) ?? []) {
    const digits = run.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  return false;
}

export function checkTypedText(text: string): Checked<string> {
  if (text.includes("\0")) return fail("Invalid text.");
  if (looksLikeSecret(text)) {
    return fail("That looks like a payment card or secret. Never type those: ask the user to take over the computer.");
  }
  return { ok: true, value: text };
}

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

/** Parses COMPUTER_ALLOWED_HOSTS ("a.com, b.org") into lowercase hostnames. */
export const parseAllowedHosts = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
