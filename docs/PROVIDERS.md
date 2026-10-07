# SpectreMail Provider Findings

> **Status:** M0 provider compatibility spike — findings from a real run.
> **Delivery evidence run:** `2026-10-01T18-08-41-251Z` (36 probes: 26 passed,
> 6 failed, 3 unsupported, 1 unverified) — includes real external delivery on
> **both** providers.
> **Fix-validation run:** `2026-10-01T19-07-42-576Z` (36 probes: 25 passed, 5 failed,
> 3 unsupported, 3 unverified) — run at the corrected code state, validating
> the harness fixes in §5.1. Its own delivery checks are `unverified`: no message
> was sent during its window, so it adds no delivery evidence.
> **Earlier run:** `2026-10-01T17-20-33-861Z` (25 passed, 5 failed, 3 unsupported,
> 3 unverified) — structural evidence; its delivery results were invalidated by two
> harness defects, see §5.1.
> **Harness:** `tests/provider-spike/` — disposable, not product code.
> **Re-run before release.** Provider behaviour and terms change. Every claim below
> traces to a probe in a run cited above, **except** where a section states its own
> non-probe basis and retrieval date — §2's provider-terms and published-lifetime
> findings, which no probe captures. Claims with no recorded evidence are labelled
> as such.
>
> **What follows from this document.** These are measurements, not requirements.
> The behaviours they imply are specified separately in the `provider-abstraction`
> capability (`openspec/specs/provider-abstraction/spec.md`), which states the
> corrected per-client roles and turns each measured constraint below — untrustworthy
> content type, no working push transport, `1; w=60` account creation, the wildcard
> host-permission form, and the absent mailbox TTL — into a requirement. Where this
> document and that spec disagree, the spec governs the implementation and this
> document is the evidence behind it.

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

Mail.tm is therefore excluded from the website. A SpectreMail-operated proxy
would technically make it reachable, and SpectreMail does not do that: relaying a
provider API to work around an origin restriction is out of scope as a matter of
policy, independent of what any provider's terms permit. See §2 for the
unresolved question of what Mail.tm's terms actually say — no terms page exists
and the FAQ is silent, so **no proxying decision may cite the provider's terms.**

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

| Endpoint | Policy | Measured how |
|---|---|---|
| `GET /domains` | `30; w=60` | unauthenticated |
| `GET /messages` | `30; w=60` | **unauthenticated only** — the authenticated policy was not separately measured |
| `POST /accounts` | **`1; w=60`** | authenticated |

**One mailbox per 60s window.** The `ratelimit-policy` header does not state its
scope, so "per IP" is an inference and not evidenced. A `429` was observed in run
`2026-10-01T18-18-42-250Z`, on probe `mailtm.validation-error`, which **failed** —
but that 429 was the spike's own ungated call exceeding the budget, not a clean
provider throttle, so it evidences the limit's existence only. This directly
contradicts the roadmap's UX target of "Open app → usable email: a few seconds" and
"Generate mailbox: 1 action or automatic". A user who clicks "new address" twice in
a minute gets a `429` and a dead end. The spike enforces this budget itself by
serialising account creation; production must do the same, and must design the UI
around it (reuse the current mailbox, disable/queue regeneration, and treat rate
limiting as a normal state rather than an error).

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

#### Re-measured 2026-10-07 against the **built** extension, both ways

The spike result above came from an MV3 manifest the harness generated at run
time. M8 ships a real `dist`, so the claim was re-measured against that
instead — and **both directions were run, because a permission that was only
ever tested granted cannot distinguish a correct manifest from one that happens
to work**:

```text
node apps/extension/e2e/live-host-permission.mjs

  PASS  wildcard   https://api.mail.tm/*   → HTTP 200
  PASS  slash-less https://api.mail.tm     → refused (TypeError: Failed to fetch)
  exit 0
```

**The refused run is the load-bearing one.** A check that only confirms the
grant succeeds would pass against a manifest with no host permission at all if
the request happened to be reachable some other way, and would pass against the
slash-less form if Chromium had ever treated it as a match. Watching the wrong
form fail is what establishes that the wildcard is doing the work.

**This is the only live network call in this repository**, and it is the *last*
open item from the M0 probe list — §5.2's "there is still no Playwright suite
for the M0 spike's own live host-permission check" is now closed, by a script
rather than by a suite. It is deliberately **not** in `package.json`'s scripts,
**not** run by `pnpm verify`, **not** run by either browser config, and a
boundary assertion (`runs the live host-permission check nowhere, deliberately`)
fails the build if any of those three changes. A test that contacts a real
provider cannot be one a contributor runs by accident, and the quarantine is
only worth having if something enforces it.

**What it does not establish.** It does not establish that the extension works
against Mail.tm in general — one anonymous `GET /domains` is not a mailbox
lifecycle, and `use it externally` remains unverified. See §5.2.

### Expiration behaviour — mailbox lifetime **published**, message retention **published**

Partially closed on **2026-10-02** by reading Mail.tm's own FAQ rather than the
API:

- **Mailbox lifetime: no expiry.** The FAQ states "your mailbox stays valid
  until you delete it yourself". So a Mail.tm mailbox does not silently expire on
  a timer.
- **Message retention: 7 days.** "We store messages for 7 days only."

Two caveats before this is treated as settled:

- This is a **published statement, not a measurement.** No spike probe held a
  mailbox open past either horizon, so the behaviour is unverified against the
  live API.
- Neither value appears **in the API response**, so a client cannot discover them
  programmatically. They are documentation to design against, not values to read.

The roadmap's `MailboxStatus` of `active | expired | unavailable` still must not
assume a **countdown**: no client can learn when the 7-day horizon passes for a
given message, and the mailbox itself has no expiry to count down to. Expiry must
remain driven by an observed signal.

### Terms that affect the product — **NOT VERIFIED**

Earlier revisions of this document quoted Mail.tm terms forbidding proxying,
reselling, and requiring attribution. **Those quotations could not be located.**
Checked on **2026-10-02**:

```text
https://mail.tm/terms      404 "Page not found" — there is no terms page
https://mail.tm/en/faq/    200 — no proxy, resale, attribution or quota terms
https://mail.tm/llms.txt   200 — site map: /en, /contact, /faq, /feedback, /privacy
```

No spike probe ever fetched or captured provider terms, so no run artifact
records them. **Treat every terms-derived claim below as unverified.** They are
retained here only so the gap is visible rather than silently dropped, and none
of them may be cited as a reason to make an architectural decision.

What the located pages *do* say, quoted:

> **How do I extend the lifetime of my temporary mailbox?** There is nothing to
> extend: your mailbox stays valid until you delete it yourself.

> **How long do you store incoming messages?** We store messages for 7 days only.

**Consequences, stated carefully:**

- **Proxying.** The measured CORS result already excludes Mail.tm from the
  website, so no architectural decision currently depends on the terms. The
  no-proxy *rule* stands on its own purpose: SpectreMail does not relay provider
  APIs to work around an origin restriction. It is **not** justified by a
  quotation that could not be found.
- **Attribution.** No attribution obligation could be verified. The homepage and
  FAQ are silent. Do not claim a visible mail.tm credit is required until
  verified — and equally, do not assume one is not.
- **Reselling.** Unverified. Any future paid tier needs this checked first.
- **Message retention is published: 7 days.** See §5.2 — this partially closes
  the TTL gap that was previously recorded as fully open.

**Open action:** locate Mail.tm's actual terms, if they exist, and record the URL
and retrieval date. Until then this section is a known gap, not a source.

**These withdrawn claims survive in the archived M0 change**, which is frozen
history and is not edited: `archive/2026-10-02-m0-provider-spike/proposal.md` states
the proxying and per-IP claims, and `archive/2026-10-02-m0-provider-spike/tasks.md`
task 5.3 says the delivered message arrived "with an empty sender". All three are
falsified — the latter contradicted by the very run artifact the archive cites.
Read this section, not the archive, for terms and lifetime claims.

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

### 4.1 MV3 runtime facts, measured against the **built** extension (2026-10-07)

These are properties of Chromium, not of either provider, and they were
assumptions written as if they were facts until M8 measured them. Chromium 141
(Playwright 1.63.0), headless, unpacked.

| Question | Measured answer | What it does **not** establish |
|---|---|---|
| Does an idle background worker survive? | **Still registered after a full 30 000 ms** idle, no events dispatched, no alarm created | **No lifetime.** It was alive when the measurement stopped, so the termination point is unmeasured. A *bound*, not a figure. |
| Does `chrome.alarms` enforce a period floor? | **None found.** Every requested period was stored unchanged — 5 000/60 000, 30 000/60 000, `1`, `1/60`, and **0.0166 minutes (999.6 ms)** | **When Chromium fires.** Chrome documents *packing* recurring alarms to at most once per 30 s, and `getAll()` reports the **requested** period, not the packing interval. "The API accepted 5 s" and "a worker wakes every 5 s" are separate claims; only the first is established. |
| Is `chrome.alarms` available to the shipped worker? | **No — `undefined`.** | This is a *result*, not a gap: `static/manifest.json` requests only `storage`, so the absence confirms the manifest requests nothing no surface uses. |

**The alarms floor was measured through a throwaway fixture, and that is worth
stating as a finding of its own.** The obvious instrument — calling
`chrome.alarms` in the shipped worker — **failed with `TypeError: Cannot read
properties of undefined (reading 'create')`**, because the API does not exist
without the `alarms` permission, and the shipped manifest deliberately omits it.
So the two requirements conflicted *for the instrument*: measuring the floor
required declaring a permission no user-facing feature needs.

The first attempt therefore established a fact worth more than the measurement it
was trying to make — **the platform, not a JSON review, confirmed that the
shipped manifest claims nothing it does not use.** The floor itself was then
measured in `apps/extension/e2e/fixtures/alarm-probe/`, which declares `alarms`
and ships nothing else. Same quarantine shape as the live host-permission check
above and as `tests/provider-spike/`: **the instrument that answers a question
may need rights the product must not have.**

**The open question this leaves, named.** D1 (no polling in the background
worker) rests on the packing interval, which is still unmeasured. Nothing in
this repository knows whether a background poller would wake every 5 seconds or
every 30; `packages/mailbox`'s `INBOX_POLL_PROMPT_MS` of 5 000 is a *page*
cadence. Whoever schedules background polling inherits an unanswered question,
and it is not one this file answers.

### 4.2 Content-script facts, measured before the in-page milestone was built (2026-10-07)

Measured while `in-page-address` (M9 slice 1) was still at proposal stage, because two of its
decisions rested on assumptions written as if they were facts. Chromium (Playwright 1.63.0),
unpacked, against a throwaway probe whose only service worker exists so the extension loads at all.

| Question | Measured answer | What it does **not** establish |
|---|---|---|
| Does a declared content script need a matching `host_permissions` entry to be injected? | **No.** `matches: ["http://127.0.0.1/*"]` injected with `host_permissions` left at only the two provider origins | Nothing about a page served over HTTPS. The probe origin is plain HTTP on loopback. |
| Can a content script read `chrome.storage.local`? | **Yes**, on the `storage` permission alone — read *and* write, value read back through the platform API | Nothing about the `sync` area, and nothing about whether a large record behaves the same. |
| Can a content script read a page's JavaScript globals? | **No.** Its `globalThis` is the **isolated world**; a value the page assigned was invisible, *including one assigned before the content script ran at all* | Nothing about the DOM, which is shared — that half is the channel this repository uses. |
| Does a plain `input.value = x` reach a React controlled input's state? | **Yes, on React 19.3.0** — the prototype's own setter was not required | **Nothing about any other framework.** A framework that keeps its own value tracker is exactly the case where direct assignment fails, and none has been measured. |
| Do the dispatched events matter? | **They are the whole mechanism.** Assigning the value and dispatching nothing left React's state empty while the field painted the address | Nothing about a framework listening for some third event. |
| Does a shadow root keep a page's own styles out? | **Yes**, and demonstrably: the fixture's hostile `button { display: none !important }` computed `display: none` on the page's own button while the shadow button computed `inline-block` | **Nothing about how anything looks.** These are computed values, not rendered pixels. |

**Three harness defects found while measuring this, each of which produced a confident wrong answer
before being caught.** They are recorded because the shape is the one this repository keeps hitting.

- **Reading a page global from the content script** made every arm of the insertion measurement return
  `null`, *including the arm read before any insertion*, which should have been the empty string. Read
  as "React did not observe the insertion", that inverts the truth **and** makes a mechanism that is
  not load-bearing look essential.
- **A stylesheet that was served but never linked** made "the page's styles do not reach the
  affordance" true for the wrong reason. The control that fixed it is the page's *own* button
  reporting `display: none`.
- **`run_at: document_idle` fires after `DOMContentLoaded`**, so a probe listening for that event
  never fired. The first run reported "no affordance" — a platform-shaped conclusion from a listener
  that was registered too late.

**One observation here is explicitly not a product fact.** The fixture's plain input received
`input, input, change, change`. That is React `StrictMode` double-invoking effects in development, not
a fact about how anything dispatches events.

### 4.3 The §4.2 probe's own stated gap, closed by the built extension's own tier

§4.2's first row carries a limitation written deliberately: *"Nothing about a page served over
HTTPS. The probe origin is plain HTTP on loopback."* That gap is now closed, and it is closed by the
**shipped extension running its shipped content script**, not by another probe.

`apps/extension/e2e/in-page.spec.ts` navigates to `https://in-page.invalid` and `http://in-page.invalid`
— both fulfilled from disk by Playwright's route interception — and in both cases:

| Question | Measured against the built extension | What it does **not** establish |
|---|---|---|
| Is a content script injected on an **HTTPS** page with no matching `host_permissions` entry? | **Yes.** `host_permissions` is still exactly the two provider origins, and the affordance appears on `https://in-page.invalid` | Nothing about a page whose *content* comes from a real server. Every response here is fulfilled from disk, so this says nothing about a real `https://` deployment's headers or timing. |
| Is it injected on **`http`** as well? | **Yes.** The same fixture over `http://in-page.invalid` shows nothing until a field takes focus, one control after it, and an address in React's own state when pressed | **Nothing about mixed content, HSTS, or `http` pages that a browser upgrades to `https`.** The point is only that the second declared pattern is exercised rather than read. |

**Why this is a §4 row and not a §4.2 row.** §4.2 measured a *probe* against assumptions. This is the
same question asked of the artefact the product ships, through the tier that runs on every commit — which
is the difference between a measurement and a fact that stays true.

**And the reason the second row exists at all is a recorded gap, not a tidiness.** Until this case was
written, `content_scripts.matches` named two schemes and the tier exercised **one** of them: every other
case in the file ran over `https://`. Half the declaration was therefore evidence-free, which is the same
shape as a permission no surface uses — declared reach wider than anything measured. `manifest.spec.ts`
now also compares the declared host permissions against the origins the tier scripts a provider for
(`recorded-provider.ts`'s own table, imported rather than retyped), because **adding
`https://example.com/*` to `host_permissions` turned every case in the tier green before that comparison
existed.**

**What is still open, deliberately.** Whether a content script may `fetch` a provider origin
cross-origin is **not** measured here, and it is the fact that decides the shape of M9 slice 2. Under
MV3 a content script's `fetch` is expected to obey the **page's** CORS policy rather than the
extension's host permissions, but nothing in this repository has observed it either way, and
`in-page-address`'s own design records it as slice 2's question to answer before slice 2 is designed.

---

## 5. Real external delivery — **verified on both providers**

Run `2026-10-01T18-08-41-251Z` (`spike:interactive --timeout-ms 600000`) observed
a genuine external email arriving on **both** mailboxes. These are the provider's
own observed results, not an inference from a sent-mail folder.

```text
delivery.mailtm      [passed]  real message observed on the Mail.tm mailbox: "TEST"
  address    spikemupulgy6gkia@uberip.com
  from       Arthur Leywin <arthurleywin2026@outlook.com>
  subject    TEST
  receivedAt 2026-10-01T18:12:30+00:00
  body       "TEST M0"

delivery.guerrilla   [passed]  real message observed on the Guerrilla Mail mailbox
  address    spikemupull2b4vd@guerrillamailblock.com
  from       arthurleywin2026@outlook.com
  mailDate   2026-10-01 18:15:28
  body       <div style="font-family:Aptos,…" > test m0</div>
```

Both providers therefore complete the receive-mail lifecycle end to end with a
real external message. **This satisfies the M0 gate's core requirement.**

Three things this evidence does *not* establish:

- **The Guerrilla subject arrived empty** while the sender and body were both
  present. A missing subject must be tolerated, not treated as corruption.
  (The sender did arrive — `arthurleywin2026@outlook.com` — so an empty *sender*
  is **not** a measured case and must not be cited as one.)
- **The Guerrilla body arrived as raw HTML**, even though the message is plain
  text. This re-confirms the earlier finding: declared content type is not
  trustworthy and raw HTML must never be rendered.
- **This is one message from one sender.** Outlook accepted delivery to both
  addresses, but Outlook is not the interesting case — aggressive business and
  consumer providers are what typically blocklist these domains. Provider
  reputation risk is **not** closed by this result and must be handled as an
  explicit risk in the M3 provider spec.

### 5.1 Harness defects found while closing this gap

The earlier run `2026-10-01T17-35-14-033Z` recorded both delivery checks as
`unverified`. That result was **caused by two defects in the spike itself**, not by
provider behaviour. Both were found by measuring the harness, and both are fixed.

**Defect 1 — the Mail.tm mailbox was deleted before delivery polled it.** The
lifecycle probe deleted the account (which revokes its token) before the delivery
probes ran. Verified against the live API: after `DELETE`, `GET /me` returns
`401`, and `GET /messages` also returns `401`. A revoked token can never return
messages, so the poll loop spun for its entire window against a mailbox that no
longer existed. No sender could ever have been observed.

*Fix:* deletion moved into `runMailTmDeletionProbes`, which `run.mjs` now invokes
**after** the delivery probes. The poll loop also now aborts immediately on
`401`/`403` and reports `HARNESS FAULT, not a provider result`. The post-delete
probe now also measures `GET /messages` after deletion. Run
`2026-10-01T19-07-42-576Z` records it: `deleteStatus: 204`, `meAfterDelete: 401`,
`tokenAfterDelete: 401`, `messagesAfterDelete: 401`. The `401` that justifies the
abort guard is therefore measured, not asserted.

**Defect 2 — the Guerrilla address printed to the maintainer was stale.** The
`set_email_user` probe renamed the mailbox but did not update the tracked
address. The delivery probe therefore printed the pre-rename address while
polling the post-rename mailbox. A sender emailing the printed address would have
delivered to a mailbox the poll loop was not reading. Verified against the live
API: `set_email_user` returns a different `email_addr`, confirming the drift.

*Fix:* the probe now updates the tracked address and records `previousAddress`, and
re-reads the served address if the rename reports none, so the failure branches
cannot leave a stale address behind.

**Defect 3 — the delivery probe could have counted the provider's own mail,
found by review rather than by running.** The delivery probe
matched `list[0]` with no sender filter. Guerrilla seeds the inbox with its own
"Welcome to Guerrilla Mail" message, which arrives with HTTP 200 like any other,
so the probe could have recorded `passed` using the provider's own welcome mail as
proof of external delivery. It happened to return the maintainer's real message in
the cited run, but the false-pass path was open. The probe now excludes messages
that predate the check and messages from the provider's own domain, and a
self-test pins that behaviour.

**Defect 4 — a `ReferenceError` in the deletion probe, present in the cited run.**
Run `2026-10-01T18-08-41-251Z` records `mailtm.delete-account` as
`[FAILED] ReferenceError: authHeaders is not defined`, because the first
extraction of `runMailTmDeletionProbes` lost that closure. It was fixed, and a
later `--no-browser` run recorded the probe passing. It is disclosed here because
that run is the primary evidence for this document, and a reviewer must be able
to see that one probe in it failed for a code reason rather than a provider one.
The delivery results in that same run are unaffected: they were produced by the
correct poll logic, and the failure was in the deletion probe that runs after
them.

**Measured Guerrilla session shapes** (live, 2026-10-02). The guard keys only on
signals observed here, because an unmeasured key could reject a healthy mailbox
and turn a real delivery into a false harness fault:

```text
healthy  200  {"list":[...],"auth":{"success":true,"error_codes":[]}}
dead     200  {"error":"Please call get_email_address or set_email_user first",
               "auth":{"success":true,"error_codes":[]}}      <- no "list"
```

`auth.success` is `true` in **both** cases, so it cannot be used to detect a dead
session — the project's own `authError()` helper in `probes/guerrilla.mjs` is
blind to this specific failure. The usable signals are the `error` key and the
absence of `list`, both of which the delivery probe now checks.

**Why this matters beyond M0:** a harness that reports `unverified` for its own
structural reasons is worse than one that fails loudly, because it looks like a
provider limitation and would have been written up as one. Both delivery probes
now abort and report a harness fault when their own preconditions are unmet.
The guards are deliberately provider-specific and must not be generalised to a
provider that has not been measured the same way.

### 5.2 Still unverified

| Check | Why it is unverified | What it blocks |
|---|---|---|
| `guerrilla.long-run-expiry` | Requires holding a session open past the provider's expiry window. Neither provider exposes a TTL in its API. There is no equivalent Mail.tm probe; the same gap applies to it. | `MailboxStatus: expired` semantics |
| Provider reputation across senders | One sender proved delivery. Bulk senders that commonly blocklist disposable domains are untested. | Any durability claim in marketing or the privacy model |
| **Live provider polling tolerance** | Nothing in this repository has watched a real provider respond to being polled every five seconds. Both browser tiers serve **recorded** responses, and the cadence assertions read the delay the scheduler was *asked* for — which proves this repository's arithmetic and nothing about a provider's patience. | Any background-polling decision; M9 |
| **A stored mailbox reconciled against a live session** | Adoption was exercised against a recording, never against a real Guerrilla Mail session. | `use it externally`, in either client |
| **MV3 `chrome.alarms` packing interval** | §4.1 measured what the API *stores*, not when Chromium *fires*. | D1's successor: whether a background poller could wake at the page cadence at all |

These are genuine gaps and must not be reported as successes.

**One item left this list on 2026-10-07 and is now closed rather than moved
elsewhere:** `AGENTS.md` recorded, at length, that *there is still no Playwright
suite for the M0 spike's own live host-permission check* — the one deferred item
from the original probe list. `apps/extension/e2e/live-host-permission.mjs` now
runs it against the **built** extension in both directions (§2). It is a script
rather than a suite, on purpose: it contacts a real provider, so it is outside
all three suites and a boundary assertion fails the build if that changes.

---

## 6. Consequences for the roadmap

Recorded here so the plan is not silently built on disproven assumptions. The
decisions themselves belong to an OpenSpec change, not to this document.

1. **Provider roles have been re-decided** (maintainer decision, 2026-10-02):
   the website is **Guerrilla Mail only**, and the extension is **Mail.tm
   primary + Guerrilla fallback**. The alternative — evaluating a CORS-friendly
   primary for the website — was considered and deferred, as was pulling own
   infrastructure forward from M15. The website therefore has no provider
   fallback path until a second web-reachable provider exists.
2. **Mail.tm cannot be reached from the website without a relay, and SpectreMail
   does not build one.** This is a product policy, not a terms-compliance
   judgement — see §2, which records that no Mail.tm terms page could be found.
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
7. **`MailboxStatus: expired` cannot assume a known TTL** for either provider.
   Mail.tm publishes values in its FAQ only; neither they nor any Guerrilla
   equivalent are exposed in the API or were measured live.
