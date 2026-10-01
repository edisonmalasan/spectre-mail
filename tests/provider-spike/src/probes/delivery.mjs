/**
 * Real external message delivery check.
 *
 * This is the one probe the spike cannot guarantee on its own: delivering a
 * genuine external email needs a sender that actually delivers mail. So the
 * check has three honest outcomes and no fourth:
 *
 *   passed      — a real message was observed arriving through the provider API
 *   unverified  — no delivering sender was available, or the interactive window
 *                 closed with nothing arriving
 *   failed      — a message was sent and the provider never surfaced it
 *
 * It never records a check as passed without an observed inbound message.
 */

import { failed, passed, readJson, sleep, unverified } from "../probe-runner.mjs";
import { describeSenderAvailability, sendTestMessage } from "../senders/index.mjs";
import { GUERRILLA_API } from "./guerrilla.mjs";

const SUBJECT = "SpectreMail M0 verification code 583291";
const BODY = [
  "Hello,",
  "",
  "Use the following verification code to finish signing up:",
  "",
  "583291",
  "",
  "Verification link: https://example.com/verify?token=spike",
  "",
  "-- SpectreMail M0 provider spike",
].join("\n");

const DEFAULT_INTERACTIVE_TIMEOUT_MS = 5 * 60 * 1000;

function redact(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

async function pollMailTm(token, { timeoutMs, intervalMs = 5000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch("https://api.mail.tm/messages?page=1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // A deleted or revoked mailbox answers 401 here. Polling it can never observe
    // an inbound message, so bail out immediately rather than burning the whole
    // window on a mailbox that no longer exists. This is a HARNESS fault, not a
    // provider finding, and must never be recorded as one.
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `the Mail.tm mailbox rejected its own token (HTTP ${response.status}) — it was deleted or revoked before delivery was checked, so this mailbox cannot observe any message`,
      );
    }

    const body = await readJson(response);
    const members = body?.["hydra:member"] ?? [];
    if (members.length > 0) {
      const detail = await fetch(
        `https://api.mail.tm/messages/${members[0].id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const message = await readJson(detail);
      return message;
    }
    await sleep(intervalMs);
  }
  return null;
}

async function pollGuerrilla(sid, { timeoutMs, intervalMs = 5000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = new URL(GUERRILLA_API);
    url.searchParams.set("f", "check_email");
    url.searchParams.set("seq", "0");
    url.searchParams.set("sid_token", sid);
    const response = await fetch(url);
    const body = await readJson(response);
    const list = body?.list ?? [];
    if (list.length > 0) {
      const fetchUrl = new URL(GUERRILLA_API);
      fetchUrl.searchParams.set("f", "fetch_email");
      fetchUrl.searchParams.set("email_id", list[0].mail_id);
      fetchUrl.searchParams.set("sid_token", sid);
      const detail = await fetch(fetchUrl);
      return await readJson(detail);
    }
    await sleep(intervalMs);
  }
  return null;
}

export async function runDeliveryProbes(
  runner,
  { mailtm, guerrilla, sender, interactive, timeoutMs, mailFrom, log = console.log },
) {
  runner.section("Real external message delivery");

  const interactiveTimeout = Number(
    timeoutMs ?? process.env.SPECTRE_SPIKE_INTERACTIVE_TIMEOUT_MS ?? DEFAULT_INTERACTIVE_TIMEOUT_MS,
  );

  const unconfigured = describeSenderAvailability(sender, { interactive });
  const from = mailFrom ?? "SpectreMail Spike <spike@spectre.invalid>";

  // ---------------------------------------------------------------- Mail.tm
  await runner.probe(
    "delivery.mailtm",
    "Receive a real external message on the Mail.tm mailbox",
    async () => {
      if (!mailtm?.address) {
        return unverified(
          "no Mail.tm mailbox exists, so real delivery could not be attempted",
        );
      }
      const target = mailtm.address;

      if (!sender && interactive) {
        log("");
        log("  ────────────────────────────────────────────────────────────");
        log(`  Send an email NOW to:  ${target}`);
        log("  Then leave this running — the spike will observe it.");
        log("  ────────────────────────────────────────────────────────────");
        log("");
        let message;
        try {
          message = await pollMailTm(mailtm.token, { timeoutMs: interactiveTimeout });
        } catch (error) {
          return failed(`HARNESS FAULT, not a provider result: ${error.message}`, {
            address: target,
          });
        }
        if (!message) {
          return unverified(
            `interactive window of ${Math.round(interactiveTimeout / 1000)}s closed with no message at ${target}`,
            { address: target, subject: SUBJECT },
          );
        }
        return passed(
          `real message observed on the Mail.tm mailbox: "${message.subject}"`,
          {
            address: target,
            provider: "mailtm",
            from: message.from ?? null,
            subject: message.subject ?? null,
            receivedAt: message.createdAt ?? null,
            bodyExcerpt: redact(message.text ?? message.html ?? message.intro),
          },
        );
      }

      if (!sender) return unverified(unconfigured);

      try {
        await sendTestMessage(sender, { to: target, from, subject: SUBJECT, text: BODY });
      } catch (error) {
        return failed(`the configured sender rejected the message: ${error.message}`);
      }

      let message;
      try {
        message = await pollMailTm(mailtm.token, { timeoutMs: 120000 });
      } catch (error) {
        return failed(`HARNESS FAULT, not a provider result: ${error.message}`, {
          address: target,
        });
      }
      if (!message) {
        return failed(
          `a real message was sent to ${target} but the provider never surfaced it within 120s`,
          { address: target },
        );
      }
      return passed(`real message observed on the Mail.tm mailbox`, {
        address: target,
        provider: "mailtm",
        from: message.from ?? null,
        subject: message.subject ?? null,
        bodyExcerpt: redact(message.text ?? message.html ?? message.intro),
      });
    },
  );

  // ---------------------------------------------------------- Guerrilla Mail
  await runner.probe(
    "delivery.guerrilla",
    "Receive a real external message on the Guerrilla Mail mailbox",
    async () => {
      if (!guerrilla?.sid) {
        return unverified(
          "no Guerrilla Mail session exists, so real delivery could not be attempted",
        );
      }
      const target = guerrilla.address;

      if (!sender && interactive) {
        log("");
        log("  ────────────────────────────────────────────────────────────");
        log(`  Send an email NOW to:  ${target}`);
        log("  Then leave this running — the spike will observe it.");
        log("  ────────────────────────────────────────────────────────────");
        log("");
        const message = await pollGuerrilla(guerrilla.sid, {
          timeoutMs: interactiveTimeout,
        });
        if (!message) {
          return unverified(
            `interactive window of ${Math.round(interactiveTimeout / 1000)}s closed with no message at ${target}`,
            { address: target, subject: SUBJECT },
          );
        }
        return passed(
          `real message observed on the Guerrilla Mail mailbox: "${message.mail_subject}"`,
          {
            address: target,
            provider: "guerrilla",
            from: message.mail_from ?? null,
            subject: message.mail_subject ?? null,
            mailDate: message.mail_date ?? null,
            bodyExcerpt: redact(message.mail_body),
          },
        );
      }

      if (!sender) return unverified(unconfigured);

      try {
        await sendTestMessage(sender, { to: target, from, subject: SUBJECT, text: BODY });
      } catch (error) {
        return failed(`the configured sender rejected the message: ${error.message}`);
      }

      const message = await pollGuerrilla(guerrilla.sid, { timeoutMs: 120000 });
      if (!message) {
        return failed(
          `a real message was sent to ${target} but the provider never surfaced it within 120s`,
          { address: target },
        );
      }
      return passed("real message observed on the Guerrilla Mail mailbox", {
        address: target,
        provider: "guerrilla",
        from: message.mail_from ?? null,
        subject: message.mail_subject ?? null,
        bodyExcerpt: redact(message.mail_body),
      });
    },
  );
}
