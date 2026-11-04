/** Hosts on the user's own machine or private network: never loaded in the panel. */
const PRIVATE_V4 =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0$)/;
const PRIVATE_V6 = /^\[(::1?|f[cd][0-9a-f]{0,2}:.*|fe80:.*)\]$/i;

/** What the user typed → a safe http(s) URL, or why not. "example.com" becomes "https://example.com/". */
export function normalizeUrl(input: string): { url: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { url: "", error: "Type an address." };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { url: "", error: "That is not a valid address." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { url: "", error: "Only http and https addresses open here." };
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    PRIVATE_V4.test(host) ||
    PRIVATE_V6.test(host)
  ) {
    return {
      url: "",
      error: "Local and private-network addresses do not open here.",
    };
  }
  return { url: u.toString() };
}
