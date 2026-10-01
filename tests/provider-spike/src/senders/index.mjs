/**
 * Pluggable sender resolution for the real-delivery check.
 *
 * Two supported shapes, both read from the environment only:
 *   - SMTP  (SPECTRE_SPIKE_SMTP_*)
 *   - HTTP  (SPECTRE_SPIKE_SEND_URL / _TOKEN)
 *
 * If neither is configured the delivery check is `unverified`. There is no
 * built-in fallback that pretends to deliver mail: the whole point of the
 * check is that a *real* external message arrives.
 */

import { sendViaSmtp } from "./smtp.mjs";

function smtpConfigFromEnv(env) {
  if (!env.SPECTRE_SPIKE_SMTP_HOST) return null;
  return {
    kind: "smtp",
    host: env.SPECTRE_SPIKE_SMTP_HOST,
    port: Number(env.SPECTRE_SPIKE_SMTP_PORT ?? 587),
    secure: String(env.SPECTRE_SPIKE_SMTP_SECURE ?? "false") === "true",
    user: env.SPECTRE_SPIKE_SMTP_USER ?? null,
    pass: env.SPECTRE_SPIKE_SMTP_PASS ?? null,
  };
}

function httpConfigFromEnv(env) {
  if (!env.SPECTRE_SPIKE_SEND_URL) return null;
  return {
    kind: "http",
    url: env.SPECTRE_SPIKE_SEND_URL,
    token: env.SPECTRE_SPIKE_SEND_TOKEN ?? null,
  };
}

export function resolveSender(env = process.env) {
  return smtpConfigFromEnv(env) ?? httpConfigFromEnv(env) ?? null;
}

/** Human-readable reason a sender is unavailable — never includes secrets. */
export function describeSenderAvailability(sender, { interactive }) {
  if (sender) return null;
  if (interactive) return null;
  return (
    "no sender capable of delivering real mail is configured. " +
    "Set SPECTRE_SPIKE_SMTP_* or SPECTRE_SPIKE_SEND_URL (see .env.example), " +
    "or run with --interactive and send one message to the printed address. " +
    "Nothing free and credential-free can deliver real mail: Ethereal discards " +
    "all mail and Guerrilla's send endpoint is captcha-gated."
  );
}

export async function sendTestMessage(sender, message) {
  if (!sender) throw new Error("no sender configured");
  if (sender.kind === "smtp") return sendViaSmtp(sender, message);

  const response = await fetch(sender.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sender.token ? { Authorization: `Bearer ${sender.token}` } : {}),
    },
    body: JSON.stringify({
      to: message.to,
      subject: message.subject,
      text: message.text,
      from: message.from,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP sender returned ${response.status}: ${body.slice(0, 200)}`);
  }
  return { accepted: true, status: response.status };
}
