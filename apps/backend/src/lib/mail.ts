import type { Env } from "./env";

export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail] RESEND_API_KEY not set — would send to ${to}: ${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM ?? "K4 Bot <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) {
    console.error("[mail] send failed", res.status, await res.text().catch(() => ""));
  }
}
