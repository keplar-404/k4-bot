import { type Checked, fail } from "./checked";

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

