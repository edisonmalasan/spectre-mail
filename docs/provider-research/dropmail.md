# DropMail.me — provider research decision row

**Status:** RESEARCH REPORT — not a claim of integration, not an approval.
**Research date / evidence date:** 2026-11-22 (all "retrieved" dates below are 2026-11-22 unless stated).
**Researcher:** research sub-agent (`research/dropmail-api` worktree), for the SpectreMail receive-only provider expansion goal.
**Scope:** resolve the assigned unknowns for `https://dropmail.me/api/` (GraphQL): domain rotation, domain exposure, session lifetime/expiry, token/OAuth, website CORS, extension host permissions, terms/anti-abuse, create/list/read delivery model, privacy, liveness; decide per client.
**Ownership:** this file is the only repository file this worker may create or edit. `docs/PROVIDERS.md` was read only, never edited.

---

## 0. Evidence key (GOAL §3 and §8)

| Tag                    | Meaning                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **OBSERVED (live)**    | An actual network call made today, with verbatim (secret-redacted) output below.                                                         |
| **OBSERVED (browser)** | A real Chrome context measurement (browse extension or Playwright full Chromium). Node results are never labelled browser evidence here. |
| **DOCUMENTED**         | Exact quoted text from an official provider URL retrieved today.                                                                         |
| **REVIEW REQUIRED**    | Permission/terms question that is unresolved or ambiguous. Never recorded as PASS.                                                       |
| **NOT MEASURED**       | Stated with the exact tool limitation, not an inference.                                                                                 |

**Live incoming mail was NOT sent.** No fixture, no successful `create`, and no empty-inbox read is presented as delivery proof. Every count below is a snapshot with a timestamp, not a permanent inventory. **Provider count = 1; free active domains returned by the API = 19; provisioned personal domains = 0 (none added); domains with verified real incoming mail = 0 (no mail sent).**

---

## 1. Decision summary

| Question                    | Result                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are domains exposed at all? | **YES** — `query { domains }` is documented and returned 19 live domains.                                                                                                                                                                                                                                              |
| Domain rotation mechanism   | Provider-sourced, **no hardcoded list**; each `Domain` has `expiresAt`, `introducedAt`, `availableVia`, `health`. Permanent = `expiresAt: null`. Rotating = dated expiry; excluded from random draws within 30 days of expiry, still explicitly selectable, gone after expiry. No explicit `active`/`retired` boolean. |
| Session lifetime / expiry   | Default **10 minutes, sliding**, extended on every access; measured directly (03:52:06 → 03:53:12 after a 65 s gap). Mails are destroyed permanently on expiry; addresses can be restored.                                                                                                                             |
| Token / OAuth               | **Token mandatory on every request.** Free `af_…` token, no signup; 1 h and 1 day are captcha-free, 7/30/90 days require captcha. OAuth 2.1 PKCE per user is documented for third-party apps. Shipping one shared token is expressly discouraged by the provider.                                                      |
| Website-origin CORS         | **BLOCKED — measured.** No `Access-Control-Allow-Origin` header at all; cross-origin fetch from `https://example.com` failed with `net::ERR_FAILED` / `TypeError: Failed to fetch`.                                                                                                                                    |
| Extension host permission   | **WORKS — measured.** MV3 service worker with `host_permissions: ["https://dropmail.me/*"]` read the API (HTTP 401 `missing_token`); without a permission the same fetch failed.                                                                                                                                       |
| Delivery model              | Polling (`session`, `sessions`, `mailsAfterId`, `mailsConnection`) **and** real push subscriptions (HTTP long-poll up to 3 min, `multipart/mixed` streaming, WebSocket graphql-ws/Apollo). **No webhooks documented.**                                                                                                 |
| Public/shared inboxes?      | **No evidence of publicly addressable inboxes.** Addresses are server-assigned and unique; access is gated by token, session ID and a secret `restoreKey`. This is a stated product claim plus observed credential shape, not a penetration test.                                                                      |
| Terms / anti-abuse          | **REVIEW REQUIRED.** No Terms of Service document located at 5 probed paths. A generic Privacy Policy exists. Rate limiting, captcha and "use it responsibly" are documented. No explicit grant or prohibition of competitive repackaging was found.                                                                   |

### Per-client decision

| Client        | Decision                | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website**   | **BLOCKED**             | Hard CORS block measured in a real browser (§4): the API sends no ACAO to a third-party origin, so a SpectreMail web page on its own origin cannot read it — the same class of finding already recorded for Mail.tm in `docs/PROVIDERS.md`. The repository's no-proxy policy forbids relaying the API to work around this.                                                                                                                                                                                                                                                                        |
| **Extension** | **NEEDS AUTHORIZATION** | Technically reachable (host-permission bypass measured, §5), but two gates block SUPPORTED: (1) **REVIEW REQUIRED** — no terms document exists, so third-party/competitive permission is unresolved and silence is not permission; (2) a token-delivery design is required — the provider explicitly says not to ship one token inside an app, and the project forbids shared secrets in shipped code; the documented remedy (per-user OAuth 2.1 PKCE) is a new flow whose feasibility for a `chrome-extension://` redirect URI is **NOT CONFIRMED**. Not REJECTED: the technical path is proven. |

**Overall: do not integrate yet.** Website is blocked by measurement; extension is blocked on authorization and a credential-delivery design. This report does not recommend advancing to Propose/Apply.

---

## 2. Official sources (all retrieved 2026-11-22)

| Source                    | URL                                                                                                                       | What it supplied                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| API documentation         | https://dropmail.me/api/                                                                                                  | Auth, token durations, object model, workflow, create/read, subscriptions, errors, rate limiting, OAuth, MCP, news |
| GraphQL schema            | https://dropmail.me/api/schema.graphql                                                                                    | Exact field types and descriptions (downloaded verbatim, 24 772 bytes)                                             |
| Provider home             | https://dropmail.me/                                                                                                      | Product claims, domain/rotation UI copy, extended-address rules                                                    |
| Privacy policy            | https://dropmail.me/privacypolicy.html                                                                                    | Generic privacy text; "Last Edited on 2017-02-22"                                                                  |
| OAuth metadata (RFC 8414) | https://dropmail.me/.well-known/oauth-authorization-server                                                                | Endpoint list, `token_endpoint_auth_methods_supported: ["none"]`                                                   |
| HTTP endpoint             | https://dropmail.me/api/graphql/${AUTH_TOKEN}                                                                             | Live probes                                                                                                        |
| Header-token endpoint     | https://dropmail.me/api/graphql/-                                                                                         | Live probes with `Authorization: Bearer af_…`                                                                      |
| Token generation          | `POST https://dropmail.me/api/token/generate`                                                                             | One-hour anonymous token (captcha-free path)                                                                       |
| Terms of service          | **not located** — `https://dropmail.me/tos`, `/tos.html`, `/terms`, `/terms.html`, `/api/terms` all returned **HTTP 404** | Absence recorded, not interpreted as permission                                                                    |

No pricing page was located; the product is free with a donation prompt (Bitcoin/Ethereum/USDT/PayPal on the homepage). No signup, no card, no account.

---

## 3. The dated decision row (all required fields)

**Provider:** DropMail.me | **API:** GraphQL over HTTP GET/POST and WebSocket | **API version:** no version number published; schema served at `/api/schema.graphql`, documentation current as of 2026-11-22 (news feed dated through 2026-11-15) | **Verification date:** 2026-11-22.

### Free eligibility, signup, key, card, quotas, pricing, attribution

- **DOCUMENTED** (API page): _"Programmatically create disposable email addresses, receive messages in real time, and read their contents — no sign-up, no spam, no strings attached. Ideal for automated testing, onboarding flows, and AI agents that need a live inbox."_
- **DOCUMENTED**: _"No sign-up — Free tokens, no account needed"_; _"Auth: Free af\_… token as ${AUTH_TOKEN} — no sign-up required."_
- **OBSERVED (live)**: `POST /api/token/generate` with `{"type":"af","lifetime":"1h"}` returned **HTTP 200** and a 43-character `af_…` token; no captcha was presented. The docs mark only 7/30/90-day durations `(captcha)`.
- **DOCUMENTED** (token widget): _"Keep this token secret — it identifies your usage for rate-limiting."_
- **DOCUMENTED** (rate limiting): _"To protect the service from abuse, the API implements rate limiting on address creation and mail reception."_ and _"Simply slow down your requests. Rate limits are based on sliding time windows, so adding reasonable delays between operations (e.g., 1-2 seconds) will prevent issues. The API is designed for programmatic access with significantly more generous limits than you would experience accessing the website directly, but please use it responsibly."_ The 2026-02-12 news item says _"gentle rate-limits ... quite high (hundreds per-minute)."_ **No published numeric quota.**
- **Attribution obligation:** none found in the documents read. The Privacy Policy has no attribution clause. **This is silence, not permission** — see third-party use below.
- **Pricing:** free; donations solicited. No paid tier, no premium-domain flag observed in the 19 live domains.

### Permitted vs prohibited third-party / competitive use — **REVIEW REQUIRED**

- The API documentation affirmatively targets app developers: _"Building an app that gives its own users temporary addresses? Let each user get their own token via OAuth instead of shipping one token inside your app."_ and, in the OAuth section, _"Building a browser extension, a desktop/mobile app or a website that gives its own users temporary addresses? Don't ship a single token inside your app: all your users would share its rate limit. Instead, let each user get their own token through OAuth 2.1 (authorization code flow with PKCE)."_
- This is evidence that third-party app use is **contemplated**, but it is **not a terms grant**, and no Terms of Service document exists at the paths tried. The homepage also says _"Screen-scraping our website? Try our API instead!"_, which favors the API over scraping but says nothing about repackaging as a competing product.
- **No explicit permission and no explicit prohibition of a competing mail product was found.** Per the GOAL and this repository's precedent for Mail.tm, an unresolved permission is **REVIEW REQUIRED — not PASS**. Public extension distribution compatibility is likewise unestablished.

### Live domain discovery, pagination, free/premium flags, retired status, expiry

- **Domains ARE exposed.** Documented query: `query { domains { id, name, introducedAt, expiresAt, availableVia } }`; schema adds `health` and `healthCheckError`, with arguments `permanentOnly: Boolean = false` and `includeBroken: Boolean = false`.
- **OBSERVED (live, 2026-11-22T03:42:06.935Z)**: 19 domains returned; 15 with `expiresAt: null` (permanent), 4 with future expiry (rotating); all `health: "OK"`; all include `API` in `availableVia` (live values additionally include `APP`, `FORWARDING`, `TELEGRAM`, often `WEB`, sometimes `VIBER`). Full inventory in §7.
- **Rotation mechanism (DOCUMENTED, news 2026-03-08)**: _"Rotating domains — some domains now have a known DNS expiry date (Domain.expiresAt). Within 30 days of expiry they are excluded from random selection but still usable when chosen explicitly; after expiry the domain is gone entirely. Pass permanentDomainOnly: true in mutations or use domains(permanentOnly: true) to restrict to permanent domains. Rotating domains tend to be freshly registered and less likely to be spam-blocked — good for short-lived use cases."_
- **Schema (verbatim)**: `expiresAt` — _"Date when the DNS registration for this domain expires. Null means the domain is permanent (renewed indefinitely). Thirty days before this date the domain will no longer be offered as a random-draw option, but can still be selected explicitly. After this date, the domain ceases to exist."_
- **Free/premium flag:** none exposed; no premium tier observed. **Retired status:** no boolean; expressed as `expiresAt` + `health` (`OK`/`FAILING`/`BROKEN`) + `DOMAIN_NOT_FOUND` on creation. Broken domains are excluded by default; `includeBroken: true` reveals them. **Pagination:** none needed for 19 domains (plain list), so no cursor exists for `domains`; mails have Relay-style `mailsConnection`.
- **Personal domains** are private to a token identity, set up with MX records via `addDomain`; not relevant to a default SpectreMail catalog and not provisioned in this research.

### Create / auth / restore / list / read / delete / polling / message formats

- **Auth:** token in path (`/api/graphql/af_…`) or header form (`/api/graphql/-` + `Authorization: Bearer af_…`). Missing/invalid → HTTP 403 (`authentication_error`; `missing_token`); header form → HTTP 401 with `WWW-Authenticate: Bearer`. **Legacy arbitrary-string tokens fully disabled 2026-06-04.**
- **Create:** `mutation { introduceSession(input: {withAddress:true, domainId:"…", permanentDomainOnly:true}) { id expiresAt addresses { address restoreKey domain { name expiresAt } } } }`. **OBSERVED**: returned session id, `expiresAt` exactly 10 min ahead, server-assigned local part, `restoreKey`, and a `Domain` object. The local part is never user-chosen (DOCUMENTED: _"You can only choose Domain of the address, but 'login' part ... is assigned by the server automatically and is always unique and belongs to you only."_).
- **Restore:** `restoreAddress(input: {sessionId, mailAddress, restoreKey})`. DOCUMENTED: _"It is only possible to restore email addresses, not emails."_ Mails are gone permanently with the session.
- **List/read:** `session(id)` / `sessions`; `mails` (max 100, newest first), `mailsAfterId(mailId)`, `mailsConnection(after, first, before, last, sort)`, `mailsCount`. **OBSERVED**: created session readback returned `mailsCount: 0`, `mails: []`, and the same `expiresAt` within the same minute.
- **Message fields:** `id`, `receivedAt`, `fromAddr`, `toAddr`, `toAddrOrig`, `headerSubject`, `headerFrom`, `text`, `raw`, **`html`**, **`sanitizedHtml(sanitizerConfig)`**, `decodeStatus` (`OK`/`ERROR_DECODING`), `rawSize`, `downloadUrl`, `attachments`. **SpectreMail must use `text` only** — the repo rule forbids rendering provider HTML; the presence of `html`/`sanitizedHtml` is a hazard, not a feature to adopt.
- **Delete:** `deleteAddress` removes an address (not its mails); `deleteDomain`, `forwardDelete` exist. **No `deleteMessage` and no session-destruction mutation** — sessions self-destruct. Mapping to `MailProvider`: `deleteMessage` and `destroyMailbox` would be unsupported.
- **Delivery model:** polling _or_ subscriptions. DOCUMENTED: _"Periodical polling - periodically (eg, once every 10 second) inspect the contents of the Session using session(id) or sessions query"_ and _"Subscriptions - to use sessionMailReceived subscription (advanced, more efficient)"_; long-poll blocks _"up to 3 minutes"_ and returns one mail at a time. WebSocket supports `graphql-ws` and Apollo. **No webhook documented.** SpectreMail's contract intentionally has no subscribe method, so polling would be the integration shape — note that, unlike other providers investigated, DropMail's push transport is documented and appears available, so a future spec change could reconsider this.

### Privacy

- **Public inboxes:** no evidence found; the homepage states _"Each temporary email address is unique and assigned once. You are the only person who can receive your emails."_ Access requires token + session ID; restore requires a secret `restoreKey` (OBSERVED as a 32-hex string, redacted here). Not a security audit.
- **Retention:** DOCUMENTED (schema): _"When session expires, all the received emails are destroyed and all the addresses are deactivated; addresses can be later restored into another session, but emails are removed permanently."_ Strongest privacy property here: mail is not retained after expiry.
- **Privacy policy** (https://dropmail.me/privacypolicy.html, retrieved 2026-11-22): a generic template, e.g. _"Users can visit our site anonymously."_ and _"We do not sell, trade, or otherwise transfer to outside parties your Personally Identifiable Information unless we provide users with advance notice."_ It ends _"Last Edited on 2017-02-22"_ and does not address mail content, session tokens, restore keys or API data. **Do not read it as a modern data-processing statement.**
- **Token secrecy** is the operative control: _"Keep this token secret — it identifies your usage for rate-limiting."_

### Throttling, errors, liveness

- Throttling documented as above; `RATE_LIMIT_EXCEEDED` includes `extensions.captcha`, mail queries return `null` + error and active subscriptions terminate.
- **Error-shape discrepancy worth carrying:** the docs describe `SESSION_NOT_FOUND` for an expired session, but **OBSERVED** for a structurally invalid ID the API returned HTTP 200 with `{"session":null}` and `errors:[{"extensions":{"code":"resolver_error"},"path":["session"],"message":"invalid_id"}]`. A future adapter cannot assume a single code for "dead session".
- **Liveness: confirmed live today.** Two bounded probes succeeded (token generation, domain listing, session create/read, expiry slide). This establishes API availability and response shapes only — **not mail reception**.

---

## 4. Independent browser CORS measurement — WEBSITE

**Requirement:** measured from a real browser, not Node. **Tool:** T3 browse extension, real Chrome 158, own tab group `provider-research-dropmail` (closed after measurement). Page origin `https://example.com` (a normal third-party web origin). No token used, so no secret appears in any output.

**4.1 Cross-origin GET / POST / preflight from `https://example.com`** — `tools.browse.eval` results:

```json
{
  "getHeaderTokenForm": { "name": "TypeError", "thrown": "TypeError: Failed to fetch" },
  "getUrlTokenForm": { "name": "TypeError", "thrown": "TypeError: Failed to fetch" },
  "postJson": { "name": "TypeError", "thrown": "TypeError: Failed to fetch" },
  "preflight": { "name": "TypeError", "thrown": "TypeError: Failed to fetch" },
  "pageOrigin": "https://example.com"
}
```

**4.2 Network capture of the same call** (`tools.browse.network`, request actually left the browser):

```text
request: GET https://dropmail.me/api/graphql/-?query=query+%7B+domains+%7B+id+name+%7D+%7D
headers: origin: https://example.com
         sec-fetch-mode: cors
         sec-fetch-site: cross-site
         accept: application/json
         user-agent: ... Chrome/158.0.0.0 ...
resourceType: Fetch
failure: net::ERR_FAILED
responseCount: 0
```

**4.3 Same-origin positive control** — tab navigated to `https://dropmail.me/api/` (HTTP 200), same fetch:

```json
{
  "status": 401,
  "contentType": "application/json",
  "body": "{\"errors\":[{\"extensions\":{\"code\":\"authentication_error\"},\"message\":\"missing_token\"}]}"
}
```

Full response headers from the same-origin call:

```json
{
  "status": 401,
  "headers": {
    "content-length": "85",
    "content-type": "application/json",
    "date": "Sun, 22 Nov 2026 03:40:46 GMT",
    "server": "nginx/1.24.0 (Ubuntu)",
    "www-authenticate": "Bearer"
  }
}
```

There is **no `access-control-allow-origin` header at all** — not a wildcard, not an origin echo. An explicit `OPTIONS` from the same tab carrying `Origin: https://spectre.invalid`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: content-type` returned **HTTP 401 `missing_token`** with the same header set — no ACAO/ACAM preflight grant.

**Conclusion (measured):** a SpectreMail website on its own origin cannot read this API. Combined with the repository's no-proxy policy (`docs/PROVIDERS.md` §1), this is a hard block for the website.

---

## 5. Independent extension host-permission measurement

**Tool:** temporary Playwright full Chromium (`channel: "chromium"`, as required for MV3 loading), unpacked extension in a temp directory outside the repository, launched with `--load-extension=<ABS>` and `--disable-extensions-except=<ABS>`. No repository file was modified. Token not needed; no secret in output.

**5.1 Manifest (correct MV3 form):**

```json
{
  "manifest_version": 3,
  "name": "DropMail CORS probe",
  "version": "1.0",
  "host_permissions": ["https://dropmail.me/*"],
  "background": { "service_worker": "sw.js" }
}
```

_(First attempt put the host pattern under `permissions`; `chrome.permissions.getAll()` then reported `{"origins":[],"permissions":[]}` and both fetches failed. This is an instrument bug, recorded rather than counted — host patterns must be in `host_permissions` in MV3.)_

**5.2 Result:**

```text
WORKER_URL chrome-extension://lbdhiieflngoejnbemcciejapddonpok/sw.js
PERMS {"origins":["https://dropmail.me/*"],"permissions":[]}
PAGE_CONTROL {"pageToOwnOrigin":{"status":200,"len":577},
              "pageToDropmail":{"thrown":"TypeError: Failed to fetch"}}
SW_FETCH {"swToDropmail":{"status":401,
            "body":"{\"errors\":[{\"extensions\":{\"code\":\"authentication_error\"},\"message\":\"missing_token\"}]}"},
          "swToExample":{"thrown":"TypeError: Failed to fetch","message":"Failed to fetch"}}
```

The service worker **read** the CORS-hostile response (HTTP 401 body) because the host permission was granted; the same worker's fetch to `example.com` (no permission, no ACAO) failed. The ordinary page's fetch to DropMail failed as in §4. **Conclusion (measured):** extension contexts can reach the API with a `https://dropmail.me/*` host permission; adding a permission does not require a product backend. Whether distributing such an extension is permitted is a separate, unresolved question (§3).

---

## 6. Bounded live API probe (Node, secret-redacted)

One captcha-free 1-hour token per probe (2 total), no signup, no mail sent. Output is verbatim with token redacted. **Node results are live-API evidence, not browser evidence.**

```text
TOKEN_GENERATION: {"status":200,"tokenPrefix":"af_…","tokenLength":43,"note":"value redacted"}
DOMAINS_QUERY: {"httpStatus":200,"count":19,"errors":null}
DOMAINS_PERMANENT_ONLY: {"httpStatus":200,"count":15,"errors":null}
INTRODUCE_SESSION: {"httpStatus":200,"session":{
  "id":"U2Vzc2lvbjoLWGR0PL9JA7HvHIEN9xmv","expiresAt":"2026-11-22T03:51:22+00:00",
  "addresses":[{"restoreKey":"<REDACTED>","id":"QWRkcmVzczo…",
    "domain":{"name":"10mail.xyz","expiresAt":null},
    "address":"tep1wefumajob4@10mail.xyz"}]},"errors":null}
SESSION_READBACK: {"httpStatus":200,"result":{"session":{
  "mailsCount":0,"mails":[],"id":"U2Vzc2lvbjoLWGR0PL9JA7HvHIEN9xmv",
  "expiresAt":"2026-11-22T03:51:22+00:00",
  "addresses":[{"address":"tep1wefumajob4@10mail.xyz","restoreKey":"<REDACTED>",
    "domain":{"name":"10mail.xyz","expiresAt":null}}]}},"errors":null}
UNKNOWN_SESSION: {"httpStatus":200,"result":{"session":null},
  "errors":[{"extensions":{"code":"resolver_error"},"path":["session"],"message":"invalid_id"}]}
```

**Direct expiry-slide measurement** (same session, 65 s apart):

```text
SESSION_CREATED: {"expiresAt":"2026-11-22T03:52:06+00:00","address":"h0kymanytokeg5@10mail.xyz"}
EXPIRY_T0:           {"expiresAt":"2026-11-22T03:52:06+00:00","readAtUtc":"2026-11-22T03:42:07.461Z"}
EXPIRY_T_PLUS_65S:   {"expiresAt":"2026-11-22T03:53:12+00:00","readAtUtc":"2026-11-22T03:43:13.282Z"}
EXPIRY_SLIDE_OBSERVED: {"before":"2026-11-22T03:52:06+00:00","after":"2026-11-22T03:53:12+00:00","changed":true}
```

The window moved by +66 s on access — a measured sliding 10-minute session, not merely a documented claim. Both sessions were left to expire; no mail was sent to either address.

---

## 7. Domain inventory snapshot (2026-11-22T03:42:06.935Z)

`domains` returned **19** entries; **15 permanent** (`expiresAt: null`), **4 rotating** (all `health: "OK"`):

| Domain             | expiresAt                     | availableVia (live)                        | health |
| ------------------ | ----------------------------- | ------------------------------------------ | ------ |
| 10mail.info        | null                          | APP, FORWARDING, API, TELEGRAM, WEB        | OK     |
| 10mail.org         | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| 10mail.xyz         | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| dropmail.me        | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| emlhub.com         | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| emlpro.com         | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| emltmp.com         | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| freeml.net         | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| **mail2me.co**     | **2027-03-10T00:00:00+00:00** | APP, FORWARDING, API, TELEGRAM, WEB        | OK     |
| mailpwr.com        | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| mailtowin.com      | null                          | APP, FORWARDING, API, TELEGRAM, WEB        | OK     |
| maximail.fyi       | null                          | APP, API, TELEGRAM, VIBER                  | OK     |
| maximail.vip       | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| mimimail.me        | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| **pickmail.org**   | **2027-03-10T00:00:00+00:00** | APP, FORWARDING, API, TELEGRAM, WEB        | OK     |
| **pickmemail.com** | **2027-03-05T00:00:00+00:00** | APP, FORWARDING, API, TELEGRAM, WEB        | OK     |
| **picomail.biz**   | **2027-03-05T00:00:00+00:00** | APP, API, TELEGRAM                         | OK     |
| spymail.one        | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |
| yomail.info        | null                          | APP, FORWARDING, API, TELEGRAM, VIBER, WEB | OK     |

`domains(permanentOnly: true)` returned 15, matching the null-expiry subset. Two domains (`maximail.fyi`, `picomail.biz`) lack `WEB` in `availableVia` — a live illustration of why an adapter must filter by `availableVia`, not just assume every catalog entry works from every interface.

**Counts kept distinct:** provider = 1; free active domains = 19; rotating = 4; provisioned personal domains = 0; domains with verified real incoming mail = **0**.

---

## 8. Blockers, unknowns, and what this report does not establish

1. **REVIEW REQUIRED — third-party/competitive permission.** No Terms of Service document exists at the probed URLs; the Privacy Policy is a 2017 generic template. The API docs invite app developers and OAuth clients, which is favorable but is not a licence. An authorized answer must come from the provider, not from reasoning.
2. **NEEDS AUTHORIZATION — token delivery for the extension.** One shared `af_…` token in shipped code is forbidden by both the provider (_"Don't ship a single token inside your app"_) and the GOAL (no shared secret in browser code). Per-user OAuth 2.1 PKCE is documented, but the redirect-URI guidance (_"https://, http://localhost / http://127.0.0.1 ... or a private-use scheme such as myapp://callback"_) does not explicitly confirm a `chrome-extension://` redirect; whether that works is **NOT MEASURED** and would need a browser probe plus provider confirmation. A user-pasted token is possible but would need a UX/credential design and a captcha for >1-day tokens.
3. **Website: BLOCKED by measured CORS** — not a policy preference. Revisit only if the provider changes its ACAO behavior or the owner approves an architectural exception (currently forbidden).
4. **LIVE DELIVERY NOT VERIFIED.** No external message was sent to either created address. The empty-inbox read and successful create prove provisioning and read compatibility only.
5. **NOT MEASURED — rate-limit numbers.** No numeric quota is published; the probes used far below the documented "hundreds per-minute".
6. **NOT MEASURED — subscription/WebSocket transport.** Documented, not exercised; SpectreMail's contract has no subscription method anyway.
7. **NOT MEASURED — restoreAddress end to end**, expired-session behavior over time (the 10-minute expiry was observed as an expiry _timestamp_ and its sliding update, not by waiting for destruction), `sanitizedHtml` behavior, or attachment parsing.
8. **An instrument bug was found and corrected** during extension measurement (host pattern in `permissions` instead of `host_permissions`); the first result was discarded rather than counted.
9. **Provider behavior and terms change.** This record is a dated snapshot (2026-11-22); the API news feed itself documents several breaking changes in 2026. Re-read before any integration.

**Exact commands run (evidence reproducibility):** `curl.exe -sSL https://dropmail.me/api/schema.graphql` (24 772 bytes); `curl.exe -sS -o NUL -w "%{http_code}"` over the five ToS paths; `node dropmail_probe.mjs` and `node dropmail_probe2.mjs` (temp dir, token redacted); `tools.browse.navigate/eval/network` on the browse extension (tab group closed); `node dropmail-ext-probe.cjs` and `node dropmail-ext-debug.cjs` with `NODE_PATH` set to `apps/web/node_modules` and Playwright 1.63.0 full Chromium. All probes lived in the OS temp directory; no probe file is part of this repository.
