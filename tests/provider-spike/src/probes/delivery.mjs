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

/**
 * Poll a Guerrilla inbox until a message arrives or the deadline passes.
 *
 * Guards two harness faults, both of which would otherwise be misrecorded as a
 * provider gap:
 *
 *   1. A dead session. Guerrilla does NOT answer 401 for an unusable sid_token —
 *      it answers 200 with an empty inbox and no auth error (measured by
 *      `guerrilla.stale-session`). So a status check alone cannot detect this.
 *      When the provider does surface an auth error, abort rather than spin.
 *   2. Provider-generated mail. Guerrilla seeds the inbox with its own
 *      "Welcome to Guerrilla Mail" message, which also arrives with HTTP 200.
 *      Matching `list[0]` would return the provider's own mail and record a
 *      false `passed`, so messages are filtered by the sender we expect.
 */
async function pollGuerrilla(
  sid,
  { timeoutMs, intervalMs = 5000, knownMailIds = new Set() },
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = new URL(GUERRILLA_API);
    url.searchParams.set("f", "check_email");
    url.searchParams.set("seq", "0");
    url.searchParams.set("sid_token", sid);
    const response = await fetch(url);
    const body = await readJson(response);

    // Detect a dead session. Measured shapes from the live API:
    //   healthy  -> 200, { auth: { success: true, error_codes: [] }, list: [...] }
    //   dead     -> 200, { error: "Please call get_email_address or set_email_user first",
    //                       auth: { success: true, error_codes: [] } }   <- note: NO list
    // So `auth.success` is true in BOTH cases and cannot be used here; the usable
    // signals are the `error` key and the absence of `list`. Only measured keys
    // are checked — an unmeasured one could reject a healthy mailbox and turn a
    // real delivery check into a false harness fault.
    const sessionError = typeof body?.error === "string" ? body.error : null;
    if (!response.ok || sessionError || !Array.isArray(body?.list)) {
      throw new Error(
        `the Guerrilla Mail session is unusable (HTTP ${response.status}` +
          `${sessionError ? `, ${sessionError}` : ""}` +
          `${Array.isArray(body?.list) ? "" : ", no list in the response"}` +
          `) — this mailbox cannot observe any message`,
      );
    }

    const list = body.list;
    // Ignore mail that predates the delivery check, and mail the provider itself
    // generated. Guerrilla seeds the inbox with its own welcome message, which
    // arrives with HTTP 200 like any other, so neither check alone is sufficient.
    const candidate = list.find((m) => {
      if (knownMailIds.has(m.mail_id)) return false;
      const from = String(m.mail_from ?? "").toLowerCase();
      // The provider's own domain covers both @guerrillamail.com and the
      // @guerrillamailblock.com mailboxes, which is what it actually sends from.
      if (from.endsWith("@guerrillamail.com") || from.endsWith("@guerrillamailblock.com")) {
        return false;
      }
      return true;
    });

    if (candidate) {
      const fetchUrl = new URL(GUERRILLA_API);
      fetchUrl.searchParams.set("f", "fetch_email");
      fetchUrl.searchParams.set("email_id", candidate.mail_id);
      fetchUrl.searchParams.set("sid_token", sid);
      const detail = await fetch(fetchUrl);
      return { message: await readJson(detail), mailId: candidate.mail_id };
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
      // A session without an address cannot be advertised to a sender, and polling
      // it would be meaningless. That is a harness fault, not a provider gap.
      if (!guerrilla.address) {
        return failed(
          "HARNESS FAULT, not a provider result: the Guerrilla Mail session has a sid_token but no address to poll or advertise",
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
        let found;
        try {
          found = await pollGuerrilla(guerrilla.sid, {
            timeoutMs: interactiveTimeout,
            knownMailIds: guerrilla.knownMailIds ?? new Set(),
          });
        } catch (error) {
          return failed(`HARNESS FAULT, not a provider result: ${error.message}`, {
            address: target,
          });
        }
        if (!found) {
          return unverified(
            `interactive window of ${Math.round(interactiveTimeout / 1000)}s closed with no message at ${target}`,
            { address: target, subject: SUBJECT },
          );
        }
        const message = found.message;
        return passed(
          `real message observed on the Guerrilla Mail mailbox: "${message.mail_subject ?? "(no subject)"}"`,
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

      let found;
      try {
        found = await pollGuerrilla(guerrilla.sid, {
          timeoutMs: 120000,
          knownMailIds: guerrilla.knownMailIds ?? new Set(),
        });
      } catch (error) {
        return failed(`HARNESS FAULT, not a provider result: ${error.message}`, {
          address: target,
        });
      }
      if (!found) {
        return failed(
          `a real message was sent to ${target} but the provider never surfaced it within 120s`,
          { address: target },
        );
      }
      const message = found.message;
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
