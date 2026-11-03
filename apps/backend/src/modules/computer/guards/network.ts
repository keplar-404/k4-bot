import { type Checked, fail } from "./checked";

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

/** Parses COMPUTER_ALLOWED_HOSTS ("a.com, b.org") into lowercase hostnames. */
export const parseAllowedHosts = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
