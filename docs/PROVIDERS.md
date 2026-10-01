# SpectreMail Provider Findings

> **Status:** M0 provider compatibility spike — findings from a real run.
> **Evidence run:** `2026-10-01T17:20:33-861Z` (36 probes: 25 passed, 5 failed, 3 unsupported, 3 unverified)
> **Harness:** `tests/provider-spike/` — disposable, not product code.
> **Re-run before release.** Provider behaviour and terms change. Every claim below
> traces to a probe in the run cited above. Claims with no recorded evidence are
> labelled as such.

---

## 1. Headline result

**The roadmap's provider plan is inverted for the website.**

| Provider | Normal web page | Chromium extension | Verdict |
|---|---|---|---|
| Mail.tm | ❌ unreachable | ✅ full lifecycle | **Extension-only** |
| Guerrilla Mail | ✅ reachable | ✅ reachable | **Usable in both** |

`api.mail.tm` sends `Access-Control-Allow-Origin` **only to its own origins**
(`https://mail.tm`, `https://api.mail.tm`). A SpectreMail web page on its own
domain receives no CORS header and cannot read the API at all — not even the
public domain list. This was measured in a real browser, not inferred from
headers:

```text
cors-headers.mailtm        [failed]  grants no ACAO to any third-party origin
                                     https://spectre.invalid → no ACAO
                                     http://localhost:5173 → no ACAO
                                     https://mail.tm        → https://mail.tm
browser.normal-web-page.mailtm [failed] blocked from http://127.0.0.1:PORT
```

Mail.tm's published terms additionally forbid the obvious escape hatch:

> No proxy services — Don't mirror or proxy our API under a different domain.

So a SpectreMail-operated proxy is **not** a compliant workaround. The roadmap
already anticipated this shape of outcome for Guerrilla Mail ("Do not introduce a
fragile proxy merely to force equal behavior"); the same rule now applies to
Mail.tm, in the opposite direction.

---

## 2. Mail.tm

### Working endpoints (all observed live)

| Operation | Request | Observed |
|---|---|---|
| Domain discovery | `GET /domains?page=1` | `200`, `uberip.com` (1 active domain) |
| Create mailbox | `POST /accounts` | `201`, quota `40000000` |
| Authenticate | `POST /token` | `200`, 359-char JWT |
| Read mailbox | `GET /me` | `200`, address matches |
| List messages | `GET /messages?page=1` | `200`, hydra collection |
| List past the end | `GET /messages?page=2` | `200`, empty collection |
| Fetch message | `GET /messages/{id}` | `200` |
| Delete mailbox | `DELETE /accounts/{id}` | `204`, then `GET /me` → `401` |
| Unknown message | `GET /messages/{uuid-zero}` | `404` hydra error |
| Invalid payload | `POST /accounts` bad address | `422` `ConstraintViolationList` |
| Wrong password | `POST /token` | `401` `"Invalid credentials."` |

The API is API Platform / Hydra: responses are JSON-LD, errors are
`hydra:Error` bodies, and resource URLs are returned as `@id` (relative), so
deletion must use the hydrated `@id`, not a hand-built path.

### Auth model

Bearer JWT from `POST /token`, using the same address+password used to create
the account. Tokens are per-account and are invalidated by mailbox deletion
(observed: `GET /me` → `401` immediately after `204` on delete).

Credentials are a plain local-part + password pair generated client-side. This
maps cleanly onto the roadmap's discriminated `ProviderCredentials` type: Mail.tm
and Guerrilla session data never need to be confused.

### Rate limits (hard product constraint)

Advertised via the `ratelimit-policy` response header:

| Endpoint | Policy |
|---|---|
| `GET /domains` | `30; w=60` |
| `GET /messages` | `30; w=60` |
| `POST /accounts` | **`1; w=60`** |

**One mailbox per minute per IP.** This directly contradicts the roadmap's UX
target of "Open app → usable email: a few seconds" and "Generate mailbox: 1
action or automatic". A user who clicks "new address" twice in a minute gets a
`429` and a dead end. The spike enforces this budget itself by serialising
account creation; production must do the same, and must design the UI around it
(reuse the current mailbox, disable/queue regeneration, and treat rate limiting
as a normal state rather than an error).

### Real-time delivery: **not available**

Probed five SSE candidate paths and two WebSocket candidates:

```text
mailtm.realtime-sse        [unsupported]  every path answered 404/406, no stream opened
mailtm.realtime-websocket  [unsupported]  no endpoint accepted a connection
```

`GET /messages/events` returns `406` for `Accept: text/event-stream` (the API
Platform negotiator lists only JSON/XML/YAML/CSV formats) and `404` for every
format it *does* accept. `/events` is `404`.

Note the provider's own marketing copy claims you can "listen in real-time with
SSE". That does not match the deployed API. **Consequence:** M3's "SSE
subscription if stable" must be dropped for Mail.tm, and M6's "SSE where
reliable / adaptive polling otherwise" resolves to **adaptive polling only**.

### CORS and browser restrictions

- `GET` with any third-party `Origin` → no `Access-Control-Allow-Origin`.
- `OPTIONS /accounts` preflight → `200` with `Access-Control-Allow-Methods` and
  `-Allow-Headers`, but **no `Access-Control-Allow-Origin`**, so the preflight
  itself fails and the request is never sent.
- Own origins (`https://mail.tm`, `https://api.mail.tm`) are allowlisted.

**From a Chromium MV3 extension it works fully**, because host permissions bypass
CORS — verified end to end, including a non-simple preflighted `POST` that
returned the real `422`:

```text
browser.extension-context.mailtm     [passed]  allowed from chrome-extension://…
browser.extension-context.preflight  [passed]  allowed (status 422)
```

### ⚠ Extension host-permission trap (measured, silent failure)

A slash-less match pattern is accepted into the manifest and then grants
**nothing**:

```text
browser.extension-host-permission-pattern  [passed]
  "https://api.mail.tm"        → blocked (TypeError: Failed to fetch)
  "https://api.mail.tm/*"      → reachable (200)
```

The extension would ship looking correct and simply never be able to reach the
provider, with an opaque error. **The extension must declare
`https://api.mail.tm/*`.** This must be covered by a test, not a code comment.

### Expiration behaviour

**Unverified.** Mail.tm's mailbox lifetime is not asserted anywhere in the API
response and cannot be measured inside a spike run. The roadmap's `MailboxStatus`
of `active | expired | unavailable` must not assume a known TTL until this is
measured by holding a mailbox open. This is a scheduled re-check, not a settled
fact.

### Terms that affect the product

From the provider's published terms, quoted:

- **No API key, no signup** for the API itself.
- **8 QPS** general quota.
- **No illegal activity.**
- **No reselling** — "Don't build a paid product that just wraps our API."
- **No proxy services** — "Don't mirror or proxy our API under a different domain."
- **Attribution required** — "If you use our API, link back to mail.tm somewhere visible."

The attribution requirement is a hard product obligation: a visible mail.tm
link is required wherever the provider is selectable. The no-reselling clause
constrains any future paid tier. The no-proxy clause is what closes off the
website workaround.

---

## 3. Guerrilla Mail

### Working endpoints (all observed live)

| Operation | Request | Observed |
|---|---|---|
| Obtain session + address | `GET ajax.php?f=get_email_address` | `200`, `email_addr` + `sid_token` |
| Reuse session | `GET ajax.php?f=check_email&seq=0&sid_token=…` | `200` |
| Set local part | `GET ajax.php?f=set_email_user&email_user=…` | `200`, new address |
| List messages | `f=check_email` | `200`, `list[]` |
| Fetch message | `f=fetch_email&email_id=…` | `200`, full body |
| Send message | `f=send_email` | `200`, `needs_captcha: true` |

### Auth model: session token, **cookies not required**

The API sets `PHPSESSID=…; domain=.api.guerrillamail.com`, but every call in
this spike was made **with no cookie jar at all**, carrying the session in the
`sid_token` query parameter instead:

```text
guerrilla.session              [passed]  session established without a cookie jar
guerrilla.session-without-cookie [passed]  session works via sid_token alone
```

This matters because the provider's CORS response makes cookies unusable from a
web page anyway:

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: (absent)
```

With `ACAO: *` and no `Access-Control-Allow-Credentials`, a browser refuses to
attach the `PHPSESSID` cookie to a cross-origin request. **The body-returned
`sid_token` is the only workable session carrier from a browser.** Any adapter
must persist the `sid_token`, not a cookie.

### Message content is raw HTML

```text
guerrilla.fetch-message  [passed]
  content_type: "text"
  size: 1042
  bodyLooksLikeHtml: true
  bodyExcerpt: "<pre>Dear Random User, Thank you for using Guerrilla Mail…"
```

The `content_type` field says `text` while the body is HTML wrapped in `<pre>`.
The metadata is misleading, and the body is untrusted markup. This confirms the
roadmap's M6 security requirement is not optional: raw provider HTML must never
be rendered, and text extraction must not trust the declared content type.

### ⚠ Expired sessions fail silently — a real data-loss trap

An unrecognised session token is **not** rejected:

```text
guerrilla.stale-session  [failed]
  HTTP 200, no auth error, empty inbox
```

A stored-but-expired Guerrilla session is therefore indistinguishable from a
genuinely empty mailbox. The product will silently show "no mail" for an address
that once had mail. The core mailbox manager must detect this (address/session
mismatch or a known-expired marker) rather than trusting a `200` + empty list.

### Sending is captcha-gated

```text
guerrilla.send  [unsupported]  needs_captcha: true
```

Non-premium sessions cannot send unattended. Consequences:

- Guerrilla cannot inject a test message.
- It cannot be used as a fallback delivery path for anything outbound.
- (Outbound mail is a V1 non-goal anyway, so this is not a product loss.)

### Expiration behaviour

Partially unverified. A fresh session reports `email_timestamp`
(`1790875239` → `2026-10-01T17:20:39Z`), which is a creation timestamp, not an
expiry. Long-run session and inbox expiry cannot be measured in a spike run and
remains **unverified**.

### CORS and browser restrictions

`Access-Control-Allow-Origin: *` on every call, from any origin. Verified
reachable from a normal web page in a real browser:

```text
browser.normal-web-page.guerrilla  [passed]  allowed from http://127.0.0.1:PORT
```

This is why Guerrilla is the only provider the website can use today.

### Terms that affect the product

Not re-verified by this spike beyond the observations above. Guerrilla Mail's
public API terms, rate limits, and attribution requirements must be re-checked
before release, per roadmap M12.

---

## 4. Browser environment matrix

Measured in headless Chromium (Playwright, `chromium` channel), MV3 extension
generated at run time with host permissions for the provider origins only.

| Check | Result |
|---|---|
| `browser.normal-web-page.mailtm` | ❌ blocked |
| `browser.normal-web-page.guerrilla` | ✅ allowed |
| `browser.normal-web-page.preflight` | ❌ blocked (JSON POST to Mail.tm) |
| `browser.extension-context.mailtm` | ✅ allowed |
| `browser.extension-context.guerrilla` | ✅ allowed |
| `browser.extension-context.preflight` | ✅ allowed (`422`) |
| `browser.extension-host-permission-pattern` | ✅ `/*` form required |

The "normal web page" origin is a real `http://127.0.0.1:<port>` origin served
by the harness — the same situation as a deployed SpectreMail page, where the
origin is a public domain the provider has never heard of.

---

## 5. Unverified — what M0 did **not** prove

These are gaps, not passes. They must not be reported as successes anywhere.

| Check | Why it is unverified | What it blocks |
|---|---|---|
| `delivery.mailtm` | No sender capable of delivering real mail was available. Nothing free and credential-free can do it: Ethereal discards all mail and states inbound is disabled for public accounts; Guerrilla's send endpoint is captcha-gated; open relays are not a legitimate option. | The M0 gate itself — "Mail.tm successfully completes the complete receive-mail lifecycle" |
| `delivery.guerrilla` | Same. | Whether a real verification mail is accepted at a Guerrilla address at all, which matters given how heavily these domains are blocklisted |
| `guerrilla.long-run-expiry` | Requires holding a session open past the provider's expiry window. | `MailboxStatus: expired` semantics |

**To close the delivery gap**, either:

- run `pnpm --dir tests/provider-spike spike:interactive` and send one message
  from an existing mailbox to the printed address, or
- configure a sender (`tests/provider-spike/.env.example`) and re-run.

Until then, the roadmap's M0 gate is **not satisfied**. Mail.tm's receive path
is proven at the API level from a privileged context, but end-to-end delivery of
a real external verification message remains unmeasured for both providers.

---

## 6. Consequences for the roadmap

Recorded here so the plan is not silently built on disproven assumptions. The
decisions themselves belong to an OpenSpec change, not to this document.

1. **Provider roles must be re-decided.** The roadmap's "Mail.tm primary,
   Guerrilla fallback" is not achievable in a browser web page. Either the
   website becomes Guerrilla-only with Mail.tm in the extension, or a
   CORS-friendly primary provider is evaluated for the website.
2. **Mail.tm cannot be reached from the website without a non-compliant proxy.**
   The roadmap's "do not introduce a fragile proxy" rule now binds Mail.tm.
3. **"Generate a mailbox in seconds" is not achievable on Mail.tm.** The
   `1; w=60` creation budget forces either mailbox reuse or a queued
   "try again shortly" flow.
4. **Drop SSE from the plan.** No provider offers it. M3's "SSE subscription if
   stable" and M6's "SSE where reliable" are dead; adaptive polling is the only
   option, and it should be designed for from the start.
5. **The extension must use `/*` host-permission patterns** and must have a
   test that fails when that regresses.
6. **Guerrilla session expiry must be detected explicitly**, because the
   provider reports an expired session as an empty inbox.
7. **`MailboxStatus: expired` cannot assume a known TTL** for either provider
   until expiry is actually measured.
