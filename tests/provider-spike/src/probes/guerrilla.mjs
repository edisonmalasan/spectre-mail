/**
 * Guerrilla Mail lifecycle probes.
 *
 * Throwaway request code. The real adapter is milestone M3 work and lives in
 * packages/providers — nothing here is importable by product code.
 */

import {
  failed,
  passed,
  readJson,
  sleep,
  unverified,
  unsupported,
} from "../probe-runner.mjs";

export const GUERRILLA_API = "https://api.guerrillamail.com/ajax.php";

/**
 * The Guerrilla API answers on `api.guerrillamail.com` and hands back a
 * `PHPSESSID` cookie scoped to `.api.guerrillamail.com`. The interesting
 * question for SpectreMail is whether a browser client needs that cookie at
 * all, so every call here is made WITHOUT a cookie jar and carries the
 * session via the `sid_token` query parameter instead.
 */
async function guerrilla(params, { headers = {} } = {}) {
  const url = new URL(GUERRILLA_API);
  for (const [key, value] of Object.entries({ lang: "en", ...params })) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { Origin: "https://spike.invalid", ...headers },
  });
  return { response, body: await readJson(response), url: url.toString() };
}

function authError(body) {
  const auth = body?.auth;
  if (!auth) return null;
  if (auth.success) return null;
  return {
    errorCodes: auth.error_codes ?? [],
    fields: auth.error_fields ?? null,
  };
}

function randomUser() {
  return `spike${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function runGuerrillaProbes(runner) {
  /** @type {{sid: string|null, address: string|null}} */
  const ctx = { sid: null, address: null };

  runner.section("Guerrilla Mail — session and address");

  await runner.probe("guerrilla.session", "Create or obtain a session", async () => {
    const { response, body } = await guerrilla({ f: "get_email_address" });
    if (!response.ok || !body?.sid_token) {
      return failed(
        `get_email_address returned ${response.status} with no sid_token`,
      );
    }
    const error = authError(body);
    if (error) {
      return failed(`get_email_address auth failure`, error);
    }
    ctx.sid = body.sid_token;
    ctx.address = body.email_addr;
    return passed(`session established without a cookie jar; address ${body.email_addr}`, {
      status: response.status,
      sidToken: body.sid_token,
      setCookie: response.headers.get("set-cookie"),
      accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
      accessControlAllowCredentials: response.headers.get(
        "access-control-allow-credentials",
      ),
    });
  });

  await runner.probe(
    "guerrilla.session-without-cookie",
    "Reuse the session with no cookie jar, sid_token as a parameter only",
    async () => {
      if (!ctx.sid) return unverified("no session was established");
      const { response, body } = await guerrilla({
        f: "check_email",
        seq: 0,
        sid_token: ctx.sid,
      });
      if (!response.ok) {
        return failed(`check_email returned ${response.status}`);
      }
      if (body?.auth && body.auth.success === false) {
        return failed(
          "session was rejected without cookies — the cookie IS required",
          authError(body),
        );
      }
      return passed("session works via sid_token alone; cookies are not required", {
        status: response.status,
        addressStillMatches: body?.email_addr ? body.email_addr === ctx.address : null,
      });
    },
  );

  await runner.probe("guerrilla.set-address", "Set a chosen local part", async () => {
    if (!ctx.sid) return unverified("no session was established");
    const { response, body } = await guerrilla({
      f: "set_email_user",
      sid_token: ctx.sid,
      email_user: randomUser(),
    });
    if (!response.ok) {
      return failed(`set_email_user returned ${response.status}`);
    }
    const error = authError(body);
    if (error) return failed("set_email_user rejected the requested local part", error);
    if (!body?.email_addr) {
      return unsupported(
        "set_email_user did not report an address; the provider may not allow a chosen local part",
      );
    }
    return passed(`address is now ${body.email_addr}`, {
      status: response.status,
      previousAddress: ctx.address,
      address: body.email_addr,
      alias: body.alias ?? null,
    });
  });

  runner.section("Guerrilla Mail — messages");

  await runner.probe("guerrilla.list-messages", "List incoming mail", async () => {
    if (!ctx.sid) return unverified("no session was established");
    const { response, body } = await guerrilla({
      f: "check_email",
      seq: 0,
      sid_token: ctx.sid,
    });
    if (!response.ok) {
      return failed(`check_email returned ${response.status}`);
    }
    const list = body?.list ?? [];
    ctx.messages = list;
    return passed(`${list.length} message(s) in the inbox`, {
      status: response.status,
      count: list.length,
      sample: list.slice(0, 2).map((m) => ({
        mail_id: m.mail_id,
        mail_from: m.mail_from,
        mail_subject: m.mail_subject,
        mail_date: m.mail_date,
        mail_excerpt: String(m.mail_excerpt ?? "").slice(0, 120),
      })),
    });
  });

  await runner.probe("guerrilla.fetch-message", "Fetch a message body", async () => {
    const list = ctx.messages ?? [];
    if (list.length === 0) {
      return unverified("inbox was empty, so no message could be fetched");
    }
    const first = list[0];
    const { response, body } = await guerrilla({
      f: "fetch_email",
      email_id: first.mail_id,
      sid_token: ctx.sid,
    });
    if (!response.ok) {
      return failed(`fetch_email returned ${response.status}`);
    }
    if (!body) {
      return failed("fetch_email returned an empty body");
    }
    const raw = body.mail_body ?? "";
    const looksHtml = /<[a-z!/][\s\S]*>/i.test(raw);
    return passed(
      looksHtml
        ? "message body is raw HTML, not plain text — this must never be rendered directly"
        : "message body is plain text",
      {
        status: response.status,
        mail_id: body.mail_id,
        mail_from: body.mail_from,
        mail_subject: body.mail_subject,
        content_type: body.content_type ?? null,
        size: body.size ?? null,
        bodyLooksLikeHtml: looksHtml,
        bodyExcerpt: raw.replace(/\s+/g, " ").slice(0, 200),
      },
    );
  });

  await runner.probe(
    "guerrilla.fetch-unknown-message",
    "Fetch an unknown message (error shape)",
    async () => {
      if (!ctx.sid) return unverified("no session was established");
      const { response, body } = await guerrilla({
        f: "fetch_email",
        email_id: 999999999,
        sid_token: ctx.sid,
      });
      if (response.ok && body && Object.keys(body).length > 1) {
        return failed(
          "fetching an unknown message returned a populated body instead of an error",
        );
      }
      return passed(`unknown message id produced status ${response.status}`, {
        status: response.status,
        errorCodes: body?.auth?.error_codes ?? [],
      });
    },
  );

  runner.section("Guerrilla Mail — session lifetime");

  await runner.probe(
    "guerrilla.stale-session",
    "Reuse a session token that was never issued",
    async () => {
      if (!ctx.sid) return unverified("no session was established");
      const tampered = `${ctx.sid}-tampered`;
      const { response, body } = await guerrilla({
        f: "check_email",
        seq: 0,
        sid_token: tampered,
      });
      const error = authError(body);
      if (error) {
        return passed("an unrecognised session token is rejected with an auth error", {
          status: response.status,
          errorCodes: error.errorCodes,
        });
      }

      // No auth error came back. Establish whether the provider silently
      // started a *new* session (address swap) or simply reported an empty
      // inbox, because those are different product risks.
      const replacement = await guerrilla({ f: "get_email_address", sid_token: tampered });
      const replacementAddress = replacement.body?.email_addr ?? null;
      const replacementSid = replacement.body?.sid_token ?? null;

      const observations = {
        status: response.status,
        tamperedSessionAcceptedWithoutAuthError: true,
        inboxContents: (body?.list ?? []).length,
        addressReturnedByCheckEmail: body?.email_addr ?? null,
        replacementAddress,
        replacementSessionTokenIssued: replacementSid,
        replacementSessionDiffers: Boolean(replacementSid && replacementSid !== tampered),
        isDifferentMailbox:
          Boolean(replacementAddress) && replacementAddress !== ctx.address,
      };

      if (observations.isDifferentMailbox) {
        return failed(
          "an unrecognised session token is NOT rejected: the provider silently issues a different mailbox, so a stored session that has expired is swapped for a new address instead of surfacing an error",
          { originalAddress: ctx.address, ...observations },
        );
      }
      return failed(
        "an unrecognised session token is NOT rejected and returns HTTP 200 with an empty inbox and no auth error, so a stored-but-expired session is indistinguishable from a genuinely empty mailbox — a silent data-loss failure mode that must be handled explicitly",
        observations,
      );
    },
  );

  await runner.probe(
    "guerrilla.session-timestamp",
    "Session timestamp reported by a fresh session",
    async () => {
      const { response, body } = await guerrilla({ f: "get_email_address" });
      if (!body?.email_timestamp) {
        return failed(`fresh session returned no email_timestamp (status ${response.status})`);
      }
      return passed(
        `fresh session reports email_timestamp ${body.email_timestamp}`,
        {
          status: response.status,
          email_timestamp: body.email_timestamp,
          asUtc: new Date(body.email_timestamp * 1000).toISOString(),
        },
      );
    },
  );

  await runner.probe(
    "guerrilla.long-run-expiry",
    "Session and address expiry over time",
    async () =>
      unverified(
        "cannot be measured inside a spike run: it would require holding a session open past the provider's expiry window. Mail.tm mailbox lifetime must be re-checked the same way before release.",
      ),
  );

  runner.section("Guerrilla Mail — send capability");

  await runner.probe("guerrilla.send", "Attempt to send a real message", async () => {
    if (!ctx.sid) return unverified("no session was established");
    const { response, body } = await guerrilla({
      f: "send_email",
      sid_token: ctx.sid,
      email_to: "spike-probe@spike.invalid",
      email_subject: "SpectreMail M0 spike probe",
      email_body: "If this arrives, the provider allows unattended sending.",
      email_from: "spike",
    });
    if (body?.needs_captcha === true) {
      return unsupported(
        "sending requires a captcha (needs_captcha=true), so this provider cannot inject a real test message unattended",
        { status: response.status },
      );
    }
    if (body?.security_check_status === true) {
      return unsupported("sending is gated behind a security check");
    }
    const error = authError(body);
    if (error) return failed("send_email rejected the request", error);
    if (response.ok) {
      return passed("send_email accepted the request", { status: response.status });
    }
    return failed(`send_email returned ${response.status}`);
  });

  return ctx;
}

/** Poll a Guerrilla inbox until a message arrives or the deadline passes. */
export async function waitForGuerrillaMessage(sid, { timeoutMs, intervalMs = 5000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await guerrilla({ f: "check_email", seq: 0, sid_token: sid });
    const list = body?.list ?? [];
    if (list.length > 0) return list;
    await sleep(intervalMs);
  }
  return [];
}
