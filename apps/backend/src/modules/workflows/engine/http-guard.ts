import { checkUrl } from "../../computer/guards/network";

/** Headers a block may not set: the runtime owns them, or they would impersonate our own calls. */
const DENIED = /^(host|content-length|cookie|connection|transfer-encoding|upgrade|x-k4-.*)$/i;
export const deniedHeader = (name: string) => DENIED.test(name);

/** Response headers worth keeping in a run's output. */
export const KEEP_RESPONSE_HEADERS = ["content-type", "content-length"];

type Where = { BETTER_AUTH_URL?: string; WEB_ORIGIN?: string };

/**
 * Whether a workflow may call this URL: public http(s) only (the computer's own URL guard: private ranges, IPv6
 * literals, internal names, credentials in the URL), never this app's own hosts, and https unless this is local dev.
 * Returns the reason when refused. DNS rebinding is not checked here: Cloudflare Workers cannot reach private networks.
 */
export function checkOutboundUrl(raw: string, env: Where): string | null {
  const checked = checkUrl(raw);
  if (!checked.ok) return checked.reason;
  const url = new URL(checked.value);
  const own = [env.BETTER_AUTH_URL, env.WEB_ORIGIN].flatMap((v) => (v ? [new URL(v)] : []));
  if (own.some((o) => o.hostname === url.hostname)) return "A workflow cannot call this app's own address.";
  const dev = own.some((o) => o.protocol === "http:" && ["localhost", "127.0.0.1"].includes(o.hostname));
  if (url.protocol !== "https:" && !dev) return "Only https URLs are allowed.";
  return null;
}
