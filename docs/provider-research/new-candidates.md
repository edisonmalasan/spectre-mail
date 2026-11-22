# New candidate discovery — receive-only temporary-email providers beyond the named eight

**Research worker:** `research/new-candidate-discovery` (isolated T3 worktree)
**Investigation date:** 2026-11-22 (all retrieval dates below are 2026-11-22 unless a source states its own revision date)
**Scope:** discover additional credible, documented, free, receive-only temporary-email APIs with **real domain discovery** beyond the GOAL's named candidates (Guerrilla Mail, Mail.tm, Mail.gw, DropMail, TempMail.lol, Tmailor, Maildrop, Temp-Mail.org). Official sources only. No account registration, no key requests, no live senders, no proxy/backend work.

**Evidence conventions used here (GOAL §§3, 8):**

- `REVIEW REQUIRED` is used wherever third-party/competitive permission is absent, silent, or ambiguous. **Silence is not permission.** No row below is graded `PASS` on that basis.
- `LIVE DELIVERY NOT VERIFIED` applies to every candidate in this report. No external sender was available and none was contacted. A `200` from a create/list/read call, and a recorded fixture, are **not** delivery proof.
- Provider count, free active domain count, provisioned domain count, and domains with verified incoming mail are reported separately. They are never merged into a single "domains" figure.
- Browser CORS was measured from `https://example.com` (a real third-party web origin the providers have never heard of) in the paired Chrome through `tools.browse.navigate` / `tools.browse.eval` / `tools.browse.network`, **not** from Node. Node fetches appear only as labelled supplementary header probes. All agent tabs opened for this work were closed.

## Tool limitations (recorded, not inferred around)

| Limitation | Exact observation |
|---|---|
| `websearch` unusable | Three `websearch` calls returned `{"error":{"type":"tool.execution","message":"Web search request failed (HTTP 402)"}}`. Discovery was therefore performed with `tools.browse` against `https://html.duckduckgo.com/html/?q=…` (real browser), and every decision row then fetched the **provider's own** docs/terms/pricing with `webfetch` or `tools.browse`. |
| 1secmail unreachable here | `webfetch https://www.1secmail.com/api/` and `.../api/v1/?action=getDomainList` → `Transport error (GET …)`; `webfetch http://www.1secmail.com/api/` → `404`; `tools.browse.navigate https://www.1secmail.com/api/` → `net::ERR_CERT_COMMON_NAME_INVALID`; same on `https://1secmail.com/api/`; `http://www.1secmail.com/api/` → `net::ERR_BLOCKED_BY_CLIENT`; `https://www.1secmail.net/api/v1/?action=getDomainList` → `Transport error`. This is a statement about **this machine/browser**, not a claim that the service is down globally. CORS and domain counts for 1secmail are `NOT MEASURED`. |
| Extension host permissions not measured per candidate | `tools.browse` exposes no unpacked-extension loader, and this fresh worktree has **no `node_modules`** (so no Playwright fixture could be built without installing tooling and writing files outside my sole owned report). The general Chromium fact that host permissions bypass CORS is recorded in `docs/PROVIDERS.md` §4 from prior repository measurements, but it was **not re-measured here**. Every extension row below says `NOT MEASURED — <this limitation>`. |
| No account/key probes | Per assignment, no signup and no key request. Providers whose usable API requires a key are evaluated from official docs only and marked `NOT MEASURED` for live calls. |

---

## Ranked shortlist

Ranking is by research interest (documented free receive-only API + real domain discovery + measured browser reachability), **not** by approval. No row is a PASS.

| # | Provider | Free keyless API? | Live domain discovery | Website-origin CORS (measured) | Overall terms verdict | Website | Extension |
|---|---|---|---|---|---|---|---|
| 1 | **GrabMail** (`grabmail.io`) | Yes (public domains) | Yes — 3 public, 97 premium names withheld | **Allowed**: `ACAO: *`, `200`, body readable | `REVIEW REQUIRED` (terms silent on third-party resale; public-inbox + no-create model) | NEEDS AUTHORIZATION | NEEDS AUTHORIZATION |
| 2 | **Best-TempMail** (`api.best-tempmail.com/v1`) | Yes | Yes — 5 domains from `GET /v1/domains` | **Blocked**: `TypeError: Failed to fetch`, no `ACAO` | `REVIEW REQUIRED` (commercial use is a paid-plan feature; "automated systems … without authorization") | REJECTED (CORS) | NEEDS AUTHORIZATION |
| 3 | **PlainlyKit** (`plainlykit.com/tools/temporary-email/api`) | Yes | Yes — 6 domains from `GET /config` | **Blocked**: `TypeError: Failed to fetch`, no `ACAO`; docs say server-to-server only | `REVIEW REQUIRED` (no ToS page located; explicit "do not expose inbox tokens in public frontend code") | REJECTED | REJECTED |
| 4 | **TempMail.io** (`temp-mail.io`, **not** temp-mail.org) | No — API key / Premium | Documented (public/premium flags) but key-gated | NOT MEASURED (key required) | ToS restricts data access to Temp Mail's own products | REJECTED | REJECTED |
| 5 | **Mailsac** (`mailsac.com/api`) | Free tier exists but **requires an account + API key** | Custom-domain API only; no free public domain-list endpoint found | NOT MEASURED (key required) | ToS prohibits third-party account creation and non-personal business use | REJECTED | REJECTED |
| 6 | **Mailinator** (`api.mailinator.com/api/v2`) | No — token requires Verified Pro signup/verification | No documented public domain-discovery endpoint found | NOT MEASURED (token required) | ToS: personal-use-only licence; automation and third-party registration prohibited | REJECTED | REJECTED |
| 7 | **1secmail** | Documented keyless API could not be read | NOT MEASURED | NOT MEASURED (cert/transport failure here) | NOT MEASURED | REJECTED (unreachable here) | REJECTED (unreachable here) |
| 8 | **TempMailGrab** (`tempmailgrab.com/api/v1`) | No — free account + key | No domain-list endpoint documented | NOT MEASURED (key required) | Terms not fully evaluated (key gating is already decisive) | REJECTED | REJECTED |

---

## Decision rows

### 1. GrabMail — `https://grabmail.io`

**Sources (all retrieved 2026-11-22):** docs `https://grabmail.io/docs`, API reference `https://grabmail.io/docs/api`, ToS `https://grabmail.io/legal/terms` (states *"Last updated 4 August 2026"*), live API `https://grabmail.io/api/v1/domains`, main site `https://grabmail.io`. **API version:** v1 in the path; reference says *"The version lives in the path, and v1 will not change shape under you — a breaking change gets a new number."*

- **Free eligibility / signup / key / card / quotas / pricing / attribution.** Official API reference, verbatim: *"Three endpoints, JSON in and JSON out. No key and no account on public domains — paste a request into a terminal and it works."* and *"Free, without a key: 60 requests a minute and 1,000 a day, per IP address. Every call on a mailbox counts … The day resets at 00:00 UTC."* and *"Within that, one read per second per address: polling a mailbox once a second is the intended rhythm."* Premium is paid: *"Premium starts at $12.99 a month"*; live `/domains` body states `Premium USD 12.99/month … Pro USD 49.99/month … Scale USD 99.99/month` and `https://grabmail.io/pricing`. No attribution clause was found in the ToS as read; **silence is neither permission nor prohibition → REVIEW REQUIRED**.
- **Permitted vs prohibited third-party/competitive use — REVIEW REQUIRED.** ToS §3 *"Nothing illegal, nothing designed to harm another person or service, and nothing that degrades the service for everyone else. … no attempt to read mailboxes on a domain you do not control."* ToS §2 *"Public domains require no account. Anybody may use any address on them, which means anybody who knows an address may read its mailbox. You accept that as a condition of using a public address."* and *"You may not claim exclusive rights over an address on a public domain, and we will not reserve one for you."* **No clause expressly permits or expressly forbids a competing third-party client or resale.** Per GOAL §3 and AGENTS.md, this is REVIEW REQUIRED, not PASS. A separate concern: the 60/min + 1,000/day cap is **per IP**, so many SpectreMail users behind one egress IP share it.
- **Domain discovery / pagination / flags / status / expiry.** Live `GET /api/v1/domains` (direct browser navigation, 2026-11-22T03:41:26Z) returned `public: ["grabmail.io","mixozia.com","linqmail.com"]`, `retention_days: 5`, `max_attachment: "5 MB"`, `blocklisted: true`, `premium: {count: 97, tld: ".com", unlocked: false, reason: "key_required", from: "$12.99/month"}`. Premium **names are deliberately withheld** without a paid key. Messages carry `expires_at`; docs: *"A message is deleted 5 days after it arrives, read or not. … It is a hard limit, not a setting."* Pagination on messages is cursor-based (`limit` 1–200, `before` + `next`). No retired-domain flag is exposed; a 404 means *"That domain is not hosted here"*.
- **Create / auth / restore / list / read / delete / polling / formats.** **No create call exists.** API reference: *"A mailbox is never created — it exists the moment a message arrives at an address, and is gone 5 days later. There is nothing to register."* `GET /api/v1/mailbox?address=…` → `{address, alias, count, next, messages[]}`; `GET /api/v1/message/{id}?mailbox=…` → `{id, from, to, subject, date, text, html, attachments[]}`; `DELETE /api/v1/message/{id}` exists. No mailbox-destroy endpoint. Polling is the documented rhythm (1 read/s/address). **This conflicts with `MailProvider.createMailbox(domain?)` and with GOAL §6's "create a provider-confirmed mailbox": there is no provider provisioning event to confirm.** Also, an empty mailbox is `200` with `count: 0` for *any* address (measured, below), so "address exists" is not observable.
- **Privacy.** Public inboxes are world-readable by address; docs and ToS both say so. A stable alias is returned per mailbox (*"whoever holds the alias sees an empty mailbox, always"*). Site footer: *"No tracking, no ads / Messages deleted after 5 days"*. **OTP mail in a world-readable inbox is a core-use-case privacy failure** unless a paid/private domain is used (out of scope).
- **Website-origin CORS — MEASURED, ALLOWED.** From `https://example.com`, `tools.browse.eval` returned `{"status":200,"body":"{\"public\":[\"grabmail.io\",…]…}"}`; `tools.browse.network` captured response headers verbatim: `access-control-allow-origin: *`, `access-control-allow-methods: GET, DELETE, OPTIONS`, `access-control-allow-headers: Authorization, Content-Type`, `access-control-max-age: 600`, `vary: Accept-Encoding\nAuthorization`. Operational endpoint `GET /api/v1/mailbox?address=research-nonexistent-20261122@grabmail.io` also returned `200` with `ACAO: *` and `{"address":…,"alias":…,"count":0,"next":null,"messages":[]}` — a harmless read of a never-created address (**not** delivery evidence).
- **Extension host permissions:** `NOT MEASURED — no unpacked-extension loader in tools.browse and no node_modules/Playwright fixture built in this worktree`. CORS is permissive, so extension reachability is not the blocker; terms and product semantics are.
- **Throttling / errors / liveness.** JSON errors with stable slugs; `429` with `Retry-After`; `402/403/404/401` on premium; docs: *"Never branch on message."* Direct navigations at 2026-11-22T03:41:26Z returned `200` from both `/domains` and `/mailbox` — service answered, but that is **not** uptime evidence.
- **Live delivery:** **NOT VERIFIED** — no external sender was used.
- **Decisions.** **Website: NEEDS AUTHORIZATION** — CORS is proven, but (a) third-party/competitive permission is unstated → REVIEW REQUIRED, (b) no provider-confirmed creation exists, so it cannot satisfy the current contract, (c) public inboxes expose OTP mail. **Extension: NEEDS AUTHORIZATION** for the same terms/semantics reasons; host-permission behaviour not measured per candidate. Do not revisit until all three are resolved.

### 2. Best-TempMail — `https://api.best-tempmail.com/v1`

**Sources (retrieved 2026-11-22):** `https://best-tempmail.com/api`, ToS `https://best-tempmail.com/terms` (*"Last updated: 27 January 2026"*), OpenAPI `https://api.best-tempmail.com/v1/openapi.json`.

- **Free eligibility / key / quotas / pricing.** API page: *"No signup, no API key needed to start"*; *"The free tier requires no authentication at all. Just call the API."* Table: Free = `$0`, `150` requests/hour, burst `100 / 10s`, **`3 / day per IP` inbox creation**, 2-hour inbox lifetime, no webhooks/OTP extraction/attachments. Paid: Founders `$19.99/yr`, Developer `$19.99/mo`, Pro `$29.99/mo`. **Commercial use is explicitly a paid-plan feature**: *"Paid plans add a higher rate limit and commercial use."*
- **Third-party/competitive use — REVIEW REQUIRED.** ToS §7 prohibits use *"through automated systems or bots without authorization"* and *"to bypass account security, subscriptions, paywalls, or legal restrictions"*. No clause expressly permits resale or a competing client. The API page's "Paid plans add … commercial use" strongly implies the free tier is non-commercial, which a shipped SpectreMail product would not be. **REVIEW REQUIRED; do not treat the free tier as authorized.**
- **Domain discovery.** `GET /v1/domains` → `{"domains":["alagen.site","dextde.site"]}` in the docs example; `GET /v1/stats` also carries `domains`. Live direct navigation at 2026-11-22T03:40:21Z returned exactly 5 domains: `["dextde.site","linsal.site","martaz.site","simtim.site","alagen.site"]` — **these are live-returned names, not a claim of completeness**. No free/premium or retired flag is exposed in `/v1/domains`; `GET /v1/health` returned `{"status":"ok","version":"1","time":"2026-11-22T03:40:21.766Z"}`.
- **Operations.** `POST /v1/inboxes` (optional `username`, `domain`, `lifetime_minutes`), `GET /v1/inboxes/{address}/messages` (paged with `limit`/`offset`, `returned`, `has_more`, `scanned`, `scan_limit_reached`), `GET /v1/inboxes/{address}/messages/{id}` (returns `text` **and** raw `html` — must be treated as untrusted, per AGENTS.md), `DELETE /v1/inboxes/{address}`, `GET /v1/inboxes/{address}/wait` (long-poll 30–55 s), `GET /v1/inboxes/{address}` metadata with `expires_at`. Free inbox lifetime 2 h. Free inboxes are **public**: *"Free inboxes are created without a key, so there is no key to check them against and they stay readable by anyone who knows the address."*
- **Privacy.** ToS §4: *"temporary email addresses are publicly accessible to anyone who knows or guesses the address, emails received are not private or confidential"*. OTP exposure risk as above.
- **Website-origin CORS — MEASURED, BLOCKED.** From `https://example.com`, both `https://api.best-tempmail.com/v1/domains` and `/v1/health` produced `TypeError: Failed to fetch`; `tools.browse.network` recorded `failure: "net::ERR_FAILED"` and **0 responses / 3 failures**. Direct top-level navigation to the same URLs returned `200` with the domain list and health JSON, so the failure is CORS, not reachability. Supplementary Node header probe (NOT browser evidence): `status=200 ACAO=null Vary=null`.
- **Extension host permissions:** `NOT MEASURED — same limitation as above`. Host permissions bypass CORS on Chromium per `docs/PROVIDERS.md` §4, but not re-measured here.
- **Decisions.** **Website: REJECTED** — browser CORS measured blocked, and no proxy is permitted. **Extension: NEEDS AUTHORIZATION** — commercial use is a paid-plan feature, automated use needs authorization, and `3 inboxes/day/IP` is unusable for a multi-user product; also public free inboxes. CORS itself is not the obstacle there, but it was not measured in an extension.

### 3. PlainlyKit — `https://plainlykit.com/tools/temporary-email/api`

**Sources (retrieved 2026-11-22):** API docs `https://plainlykit.com/developers/temporary-email`, privacy `https://plainlykit.com/privacy` (*"Last updated October 19, 2026"*), live `https://plainlykit.com/tools/temporary-email/api/config`. **No Terms of Service page was located** — only the privacy page and the API docs.

- **Free eligibility / key / quotas.** Docs: *"It is free to use, with no signup, credit card, or developer API key."* Limits: inboxes expire **24 h**; up to **100 accepted messages** per inbox, each ≤ **2 MiB**; creation capped at **10 inboxes per IP per minute**; *"Receive only: there is no sending, replying, forwarding, or webhook endpoint."* No uptime guarantee.
- **Permitted vs prohibited third-party use — REVIEW REQUIRED.** The docs **explicitly exclude browser clients**: *"Use HTTPS server-to-server requests. Cross-origin browser requests are not supported; do not expose inbox tokens in public frontend code."* A browser extension shipping an inbox token in frontend code is precisely what this prohibits. No general ToS was found, so competitive/resale permission is unstated → REVIEW REQUIRED. Sustainability note (observation, not a claim of failure): the API is one tool among many on a general "small tools" site; no SLA.
- **Domain discovery.** Docs: *"An empty object selects a random available domain. To choose one, first request GET /config, then send {\"domain\":\"one-of-the-returned-domains\"}."* Live direct navigation at 2026-11-22T03:40Z returned `{"domains":["airfryerluve.com","exoticsavors.com","food2make.com","lordrecipes.one","pincale.com","tarotelya.com"],"retentionHours":24,"maxMessageBytes":2097152}` — **6 live-returned domains**, not a completeness claim. No free/premium or active/retired flag is exposed.
- **Operations.** `POST /api/mailboxes` → `{id, address, token, createdAt, expiresAt}` (token shown once); `GET /api/mailboxes/{id}/messages` with `Authorization: Bearer <token>`; `GET .../messages/{id}` returns plain text with HTTP(S) destinations retained as URLs from HTML buttons; `DELETE /api/mailboxes/{id}` → `{"deleted":true}`. Errors include `403 for cross-origin inbox creation` — the provider actively enforces the server-to-server rule.
- **Privacy.** Privacy page: *"Incoming messages, including their sender, subject, body, and attachments, are retained so you can read them in your temporary inbox. Access lasts up to 24 hours … some message records may remain for up to seven days after deletion."* Cookieless analytics; *"There are currently no advertising trackers."* Not a public-inbox service, but the documented token model is incompatible with browser code.
- **Website-origin CORS — MEASURED, BLOCKED.** From `https://example.com`: `TypeError: Failed to fetch`; network capture `failure: "net::ERR_FAILED"`, 0 responses. Direct navigation to `/config` returned `200` with the JSON above, so this is a CORS/server policy block, consistent with the docs. Supplementary Node probe: `status=200 ACAO=null Vary=null`.
- **Extension host permissions:** `NOT MEASURED — same limitation`. Even if Chromium host permissions bypassed CORS, the provider's documented *"do not expose inbox tokens in public frontend code"* and `403 for cross-origin inbox creation` make an extension client contrary to stated use.
- **Decisions.** **Website: REJECTED** (measured CORS block + explicit server-to-server-only rule). **Extension: REJECTED** (documented prohibition on browser-side tokens; no ToS located, so permission would be REVIEW REQUIRED even if that were resolved).

### 4. TempMail.io — `https://temp-mail.io` (**distinct from named candidate Temp-Mail.org**)

**Sources (retrieved 2026-11-22):** API page `https://temp-mail.io/api`, ToS `https://temp-mail.io/terms-of-service` (*"Last updated: 29 October 2026"*). `https://temp-mail.io/pricing` returned `404` on this date; pricing was not otherwise established.

- **Free eligibility / key.** The API page is a commercial product page (*"3,500+ subscribers"*, *"30-day money-back guarantee"*). SDK examples use `'YOUR_API_KEY'`; the API is bundled with the **Temp Mail Plus** subscription. A free account/key was **not** requested, so live calls are `NOT MEASURED`.
- **Third-party/competitive use — PROHIBITED by located terms.** ToS, verbatim: *"You agree to only access Temp Mail data through the Temp Mail products (website, extensions, Telegram bot)."* A SpectreMail client is not one of those products. ToS also prohibits *"Creating accounts on third-party services for the purpose of spam, abuse, or violation of those services' terms"* and states *"Any email sent through Temp Mail may or may not be available for viewing, may be altered, and is immediately viewable by ANY user of the system."*
- **Domain discovery.** The API page documents `listDomains()` with a `type` field and an illustrative response containing `public1.com`, `public2.com`, `premium1.com` with `"type": "public"` / `"premium"`. **That is documentation illustration, not a live count.** No live inventory was measured (key required).
- **Operations / privacy / CORS.** Create email (`{email, ttl}`), list messages (`body_text`, `body_html`, `created_at`, `attachments`), TTL up to 30 days per FAQ. Public inboxes are viewable by any user. CORS for the API was **NOT MEASURED — key required and no account was created**.
- **Decisions.** **Website: REJECTED** and **Extension: REJECTED** — the located ToS restricts data access to Temp Mail's own products. Domain illustration must not be reported as an inventory.

### 5. Mailsac — `https://mailsac.com`

**Sources (retrieved 2026-11-22):** OpenAPI `https://mailsac.com/openapi-with-examples.json` (spec version `1.0.9`), pricing `https://mailsac.com/pricing`, ToS `https://docs.mailsac.com/en/latest/about/terms_of_service.html` (*"Revised October 12, 2026"*). `https://mailsac.com/terms` → `404`.

- **Free eligibility / key / quotas.** OpenAPI: *"[All subscription levels, including free accounts, may create API keys.](https://mailsac.com/v2/credentials/keys)"*. Pricing: *"Free, no signup needed: any @mailsac.com inbox receives mail. With a free account: an API key, 1 private address and 1,500 operations a month. Public inboxes are readable by anyone, so use made-up data."* Paid from `$18/month`. **A key is required for the API**, so no live call was made.
- **Third-party/competitive use — REVIEW REQUIRED and strongly adverse.** ToS §2.14, verbatim: *"Use of mailsac to receive emails to facilitate the creation of multiple accounts or identities with a third party where the customer does not have the expressed written consent of the third party is prohibited."* ToS §3.2: *"Using this service for any business operations, even once, necessitates the purchase of a subscription-based license. Incorporated or non-incorporated business use is prohibited without a paid recurring active commercial subscription."* ToS §4.11: *"Unless otherwise indicated, by using the service you acknowledge that all of your incoming emails are public, not private, and unsecured"*; §4.4 permits aggregation *"for sale or sharing with third parties or customers"*.
- **Domain discovery / ops.** OpenAPI has a Domains API described as *"APIs for managing custom domains. It is not complete"* — no free public domain-list endpoint was found. Keyless public inboxes can be read via `GET /api/addresses/{email}/messages`, but docs warn *"Throttling is frequently an issue on public inboxes."* `POST /api/addresses/{email}` reserves a private address; deletion exists. Inbound/outbound throttling is explicitly reserved in ToS §5.
- **CORS / extension:** `NOT MEASURED — API key required; no account created; no in-scope anonymous endpoint identified`.
- **Decisions.** **Website: REJECTED** and **Extension: REJECTED** — the located ToS directly prohibits the core signup-verification pattern without third-party consent and non-personal/business use without a paid subscription. Domain inventory: not measured.

### 6. Mailinator — `https://www.mailinator.com`

**Sources (retrieved 2026-11-22):** API page `https://www.mailinator.com/mailinator-api/`, home `https://docs.mailinator.com/`, ToS `https://www.mailinator.com/terms/` (page states *"Last Updated October 3rd, 2025"*).

- **Free eligibility / key.** Home: *"Mailinator still offers a 100% free, public temporary or disposable email address … any address @mailinator.com"* and *"For private domains and API access, start with the free Verified Pro plan."* API page: *"1. Subscribe to a free trial or our Verified Pro plan. 2. Generate your unique API token."* That requires signup/verification → `NOT MEASURED`, no registration performed. Paid plans shown: Business `$79/mo`, Business Plus `$159/mo`, Enterprise `$699/mo`.
- **Third-party/competitive use — REVIEW REQUIRED and strongly adverse.** ToS licence: *"Mailinator grants you a personal, non-exclusive, non-transferable, revocable, limited license to use the System and the Services solely for your personal use"*; *"any use other than the purpose for which it was intended, is prohibited"*; prohibited acts include *"Use any robot, spider, scraper, or other automated or manual means to access the System or the Services"* and *"Register, subscribe, attempt to register … any party for any products or services if you are not expressly authorized by such party to do so."* Submissions clause grants Mailinator a broad licence to user content.
- **Domain discovery / ops.** API examples cover `GET /api/v2/domains/private/inboxes/{inbox}`, `GET /api/v2/domain/private/inboxes/{inbox}/messages/{id}`, and injection. **No documented public domain-discovery endpoint was found**; private domains require a subscription. Public inboxes are explicitly public and unauthenticated.
- **CORS / extension:** `NOT MEASURED — API token requires signup/verification; no token requested`.
- **Decisions.** **Website: REJECTED**, **Extension: REJECTED** — personal-use-only licence, automation prohibition, and no documented free domain discovery. Public-inbox OTP privacy also fails the product's use case.

### 7. 1secmail — `https://www.1secmail.com`

**Sources attempted (2026-11-22):** `https://www.1secmail.com/api/`, `https://www.1secmail.com/api/v1/?action=getDomainList`, `http://www.1secmail.com/api/`, `https://1secmail.com/api/`, `https://www.1secmail.net/api/v1/?action=getDomainList`. **No official document was readable**, so every field below is `NOT MEASURED` except the exact failures in the Tool limitations table. The service was a plausible keyless candidate with a domain-list operation in common third-party references, but **third-party references are not official evidence and were not used for any decision claim**.

- **Decisions.** **Website: REJECTED (unreachable from this environment)**, **Extension: REJECTED (same)**. Terms, quotas, domain counts, CORS, and live delivery: `NOT MEASURED — cert common-name invalid on HTTPS, HTTP blocked by the browse client, and webfetch transport errors on both .com and .net hosts`. This is not a global-liveness claim.

### 8. TempMailGrab — `https://tempmailgrab.com/api-docs`

**Source (retrieved 2026-11-22):** `https://tempmailgrab.com/api-docs`.

- **Key required:** *"Create a free account on the developer dashboard (email/password or GitHub), then mint an API key."* No account was created. All live fields `NOT MEASURED`.
- **Domain discovery:** the create endpoint accepts an optional `domain` *"when multiple domains are available"*, but **no list-domains endpoint is documented**. API v1, rate limits `100 req/s` per key, TTL 600–259200 s, OTP/link extraction included.
- **Decision.** **Website: REJECTED**, **Extension: REJECTED** — key-gated (no approved credential-delivery design) and no documented domain-discovery endpoint, so it cannot contribute a domain catalog. Terms were not fully evaluated because key gating is already decisive; competitive permission is therefore also `REVIEW REQUIRED`.

---

## Live domain inventory (measured, with timestamps)

| Provider | Provider count | Free active domains returned live | Premium/private domains | Provisioned domains | Domains with verified real incoming mail |
|---|---|---|---|---|---|
| GrabMail | 1 | **3** — `grabmail.io`, `mixozia.com`, `linqmail.com` (2026-11-22T03:41:26Z, direct navigation to `/api/v1/domains`) | `count: 97`, `.com`, names withheld without paid key | **0** — no create call exists | **0** — no sender used |
| Best-TempMail | 1 | **5** — `dextde.site`, `linsal.site`, `martaz.site`, `simtim.site`, `alagen.site` (2026-11-22T03:40:21Z, `/v1/domains`) | none flagged | **0** — no mailbox created | **0** |
| PlainlyKit | 1 | **6** — `airfryerluve.com`, `exoticsavors.com`, `food2make.com`, `lordrecipes.one`, `pincale.com`, `tarotelya.com` (2026-11-22T03:40Z, `/config`) | none flagged | **0** | **0** |
| TempMail.io | 0 measured | not measured — docs illustration only (`public1.com`, `public2.com`, `premium1.com`) | `premium` type exists in docs illustration | 0 | 0 |
| Mailsac / Mailinator / 1secmail / TempMailGrab | 0 measured each | not measured | — | 0 | 0 |

**These are response snapshots at the stated times, not permanent inventories.** None of the listed domains was provisioned into a mailbox by this worker, and **none received a test message**. Do not present the sum (14 domain names) as a usable catalog: GrabMail's public domains are explicitly blocklisted (`blocklisted: true`), and no domain here has verified incoming mail.

---

## Browser CORS measurement transcripts

All from real Chrome via `tools.browse`, origin `https://example.com`, `Origin: https://example.com` on the wire.

**GrabMail — ALLOWED.**
```
tools.browse.eval: fetch('https://grabmail.io/api/v1/domains',{mode:'cors'})
{"status":200,"body":"{\"public\":[\"grabmail.io\",\"mixozia.com\",\"linqmail.com\"],…}"}
tools.browse.network response headers:
  access-control-allow-origin: *
  access-control-allow-methods: GET, DELETE, OPTIONS
  access-control-allow-headers: Authorization, Content-Type
  access-control-max-age: 600
Operational GET /api/v1/mailbox?address=research-nonexistent-20261122@grabmail.io
  {"status":200,"body":"{\"address\":…,\"count\":0,\"next\":null,\"messages\":[]}"}
  response ACAO: *
```

**Best-TempMail — BLOCKED.**
```
fetch('https://api.best-tempmail.com/v1/domains')  -> TypeError: Failed to fetch
fetch('https://api.best-tempmail.com/v1/health')   -> TypeError: Failed to fetch
network: entryCount=3, responseCount=0, failureCount=3,
         failure: "net::ERR_FAILED"
Direct navigation to both URLs: HTTP 200 with JSON -> endpoints reachable; block is CORS.
Node supplementary (NOT browser evidence): status=200 ACAO=null Vary=null
```

**PlainlyKit — BLOCKED.**
```
fetch('https://plainlykit.com/tools/temporary-email/api/config') -> TypeError: Failed to fetch
network failure: "net::ERR_FAILED", responseCount=0
Direct navigation to /config: HTTP 200 with 6-domain JSON.
Node supplementary (NOT browser evidence): status=200 ACAO=null Vary=null
```

---

## Plausible candidates explicitly rejected and why

| Candidate | Official source checked | Reason |
|---|---|---|
| `mail7.io` | `https://mail7.io/` (2026-11-22) | Domain renders a "Mail Converter Hub" content site, **not** a temporary-email provider or API. Parked/irrelevant. |
| `tempr.email` | `https://tempr.email/en/api.html` (2026-11-22) | `404` at the expected official API path; no documented API located at an official source. Not carried forward. |
| `mailnesia.com` | `https://mailnesia.com/api.php` (2026-11-22) | `404` at the expected official API path; no documented API located at an official source. |
| TempMailGrab | `https://tempmailgrab.com/api-docs` | Key-gated and no list-domains endpoint (see row 8). |
| GrabMail clones found only via aggregators (`freepublicapis.com`, `getfreeapis.com`, `apislist.com`, `apis.io`) | third-party catalogues | Used **only** as discovery pointers. Decisions cite `grabmail.io`'s own docs/ToS, not catalogue copy. |
| `temp-mail.org` | — | A **named candidate owned by another research worker**. Deliberately not evaluated here, and not conflated with `temp-mail.io` (row 4). |
| Generic "disposable domain list" services | — | Not mailbox providers: they cannot provision or read a mailbox, so they cannot supply the catalog this product needs. |

---

## Blockers, unknowns, and what I did not verify

- **No integration is authorized by this report.** Every terms verdict is `REVIEW REQUIRED` or adverse; none is `PASS`. The orchestrator must treat terms authorization as a human/owner decision.
- **No live delivery was attempted or observed** for any candidate. No domain in the inventory has verified incoming mail.
- **Extension host-permission behaviour was not measured for any candidate** (exact limitation in the table above). Only website-origin CORS was measured independently.
- **No account, key, card, or CAPTCHA was used; no quota was meaningfully consumed** (only a handful of public GETs to anonymous endpoints).
- **1secmail could not be inspected** from this environment; its rejection is "unreachable here", not a global liveness finding.
- **Node fetch header probes are not browser evidence** and are labelled as such; the CORS decisions rest on the Chrome measurements.
- The GrabMail `/domains` response contains a `tell_the_user` field addressed to assistants. It is **untrusted API response data** and was recorded as data only; it was not treated as an instruction and no subscription action was taken.
- The domain counts are point-in-time response snapshots. They must be re-fetched, with timestamps, before any catalog claim.

## Deliverable summary

Ranked shortlist: **GrabMail (needs authorization; CORS proven, but no create call, public inboxes, and silent third-party terms)**, **Best-TempMail (website CORS blocked; commercial use is a paid feature)**, **PlainlyKit (server-to-server only; CORS blocked; no ToS located)**, then four providers rejected on key/signup or explicit terms grounds and two on reachability. **No candidate is currently recommended for integration.**
