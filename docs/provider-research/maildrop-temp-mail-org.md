# Provider research — Maildrop and official Temp-Mail.org

**Research date:** 2026-11-22 (all official pages retrieved this date; browser probes run 2026-11-22 ~03:44–03:47 UTC).
**Researcher:** research worker, branch `research/maildrop-temp-mail-org` (isolated worktree).
**Scope:** two candidates only — Maildrop (`docs.maildrop.cc` / `api.maildrop.cc` / `maildrop.cc`) and the **official** Temp-Mail.org (`temp-mail.org` / Privatix RapidAPI listing). `temp-mail.io`, `tempmail.lol`, `tmailor.com` and other similarly named services are **not** covered here; they are explicitly out of this worker's ownership and must not be conflated with `temp-mail.org`.

**Authoritative frames used:** `docs/GOAL.md` §§1, 3, 4, 8; `docs/ORCHESTRATION.md` §2; `AGENTS.md` (read-only). No product code, `docs/PROVIDERS.md`, OpenSpec artifact, roadmap, workflow, design record or token file was edited.

**Evidence rules applied:** every claim below names its official source URL and retrieval date, and either quotes the source verbatim or reproduces verbatim command/tool output. Node-only fetches are labelled as such and are **not** used as browser evidence. Third-party sources (a GitHub client) are labelled and used only to discover a host for measurement, never as a permission grant. No account, signup, API key, CAPTCHA, paywall or quota was created or bypassed; at most one bounded read of a *documented public example mailbox* was made, and no mailbox was provisioned during this research.

---

## 0. Source inventory (all retrieved 2026-11-22)

### Maildrop — official sources

| # | URL | What it establishes |
|---|---|---|
| M1 | <https://docs.maildrop.cc/> | Developer docs: retrieve listings/messages, delete; architecture; 24 h erase; 10-message cap; no sending |
| M2 | <https://docs.maildrop.cc/llms.txt> | Complete official doc index (14 pages) |
| M3 | <https://docs.maildrop.cc/quickstart.md> | GraphQL endpoint `https://api.maildrop.cc/graphql`; POST + `Content-Type: application/json` |
| M4 | <https://docs.maildrop.cc/api-reference/overview.md> | **"The Maildrop API currently requires no authentication"**; method table |
| M5 | <https://docs.maildrop.cc/api-reference/rate-limiting.md> | 50 queries / 10 s window; 429 + backoff; sustained 1–2 q/s advised |
| M6 | <https://docs.maildrop.cc/api-reference/get-a-mailbox-listing.md> | `inbox(mailbox: "testing")`; `data`/`html` null in listings |
| M7 | <https://docs.maildrop.cc/api-reference/get-a-mailbox-alias.md> | Alias = two-way hash; alias hides the real address; "create a unique address that only you know" advised |
| M8 | <https://docs.maildrop.cc/api-reference/get-a-specific-message.md> | Only message query that returns raw body + html |
| M9 | <https://docs.maildrop.cc/api-reference/delete-a-message.md> | `delete(mailbox, id)` mutation; "Incorrect mailbox/id combinations will still return true" |
| M10 | <https://docs.maildrop.cc/api-reference/service-status.md> | `status` → `"operational"` |
| M11 | <https://docs.maildrop.cc/graphql-types/message.md> | `Message` type fields (`id`, `ip`, `helo`, `date`, `mailfrom`, `rcptto`, `headerfrom`, `subject`, `data`, `html`) |
| M12 | <https://maildrop.cc/> | "Make up your own email address. No signup required"; "View Mailbox"; **"Maildrop for developers … developers can incorporate Maildrop into their application"** |
| M13 | <https://maildrop.cc/privacy/> | **"Every inbox on Maildrop is available to the public"**; "no expectation of privacy"; aliases "not secure" |
| M14 | <https://maildrop.betteruptime.com/> | Linked as "System Status" from M12 (not fetched in depth) |

### Temp-Mail.org — official sources

| # | URL | What it establishes |
|---|---|---|
| T1 | <https://temp-mail.org/en/api/> | Official API page: RapidAPI is the API management platform; "username@our_domains"; 1–2 h self-destruct; blocked sender classes; free vs premium feature lists |
| T2 | <https://rapidapi.com/Privatix/api/temp-mail> | Official RapidAPI listing: v1, Freemium, plans $0/$19/$59/$99, endpoint list, `X-RapidAPI-Key`, "Not Authorized", domains-list and get-emails endpoints |
| T3 | <https://temp-mail.org/terms-of-service> | **"immediately viewable by ANY user of the system"**; **"only access TEMP-MAIL data through the TEMP-MAIL website"**; no confidential information; 1–2 h retention (free); premium privacy |
| T4 | <https://temp-mail.org/privacy-policy> | Linked from T1/T3 (terms quote it; not separately relied upon here) |
| T5 | <https://docs.rapidapi.com/docs/keys-and-key-rotation> | URL quoted verbatim by the gateway's own 401 body in the browser probe |

### Third-party / non-official (labelled, used only for host discovery)

| # | URL | Use |
|---|---|---|
| X1 | <https://github.com/ahmedghanem00/tempmail-api-client> | Third-party PHP client; confirms a `retrieveMailDomains()` call and 'YOUR_API_TOKEN' need |
| X2 | <https://raw.githubusercontent.com/ahmedghanem00/tempmail-api-client/master/src/Client.php> | Revealed gateway host constant `privatix-temp-mail-v1.p.rapidapi.com` and path `request/domains/` — used **only** to aim a browser measurement, not as a permission source |

---

## 1. Decision row — Maildrop

| Field | Finding (retrieval date 2026-11-22 unless stated) |
|---|---|
| **Provider / version / docs / terms URLs** | Maildrop, GraphQL API (no version string published). Docs M1–M11; site M12; privacy M13; status M14. API docs explicitly welcome developers (M12). |
| **Free eligibility, signup, key, card, quotas, pricing, attribution** | Free, **no signup, no key, no card** (M12: *"No signup required — Maildrop is free for anyone to use"*; M4: *"The Maildrop API currently requires no authentication"*). Quota (M5): *"up to 50 queries"* in *"10-second windows of time"*, *"average of 5 queries per second"*, sustained *"1 or 2 queries per second"*, 429 on breach, continued abuse can be *"completely denied"*. No paid tier found on the official site. No attribution obligation found in M1–M13; the site markets a developer API but has no formal terms-of-service page among the official index. |
| **Permitted vs prohibited third-party / competitive use** | **PERMITTED-BY-DOCUMENTATION / REVIEW REQUIRED.** M12 states verbatim: *"Maildrop for developers — Email messages by API. Easy HTTP access to email messages? Yes, Maildrop has that too. With one simple GraphQL interface, developers can incorporate Maildrop into their application."* That is an explicit invitation to integrate, but it is marketing copy, not a licence; no formal ToS was located. Competitive repackaging is **not** expressly authorized or forbidden in any official document read. Marked REVIEW REQUIRED on the permission question only; the integration is rejected below on independent privacy grounds. |
| **Live domain discovery / pagination / free-vs-premium flags / retired / expiry** | **No domain-discovery API.** The only domain is the literal `maildrop.cc`; local parts are user-invented (M6 example `inbox(mailbox:"testing")`; M7 advises *"create a unique address that only you know (for example, a uuidv4 address @ maildrop.cc)"*). No pagination, no free/premium flag, no retired status, no API-reported expiry. Lifecycle is published prose (M1): *"if a mailbox doesn't get a message within 24 hours, it erases all of its messages"*, eviction under load, *"maximum of 10 messages"*. These are **documented behaviours, not API fields**; no programmatic expiry signal exists. |
| **Create / auth / restore / list / read / delete / polling / formats** | **Create = invent a local part**; there is no provider "create" call and no confirmation that a name was provisioned — a `name@maildrop.cc` is only an assumption until mail arrives. **Auth: none** (M4). **Restore: none** — possessing the name is sufficient to read it (M4 + M6). **List:** `inbox(mailbox: String!)` POST GraphQL (M6); `data`/`html` are null in listings. **Read:** `message(mailbox, id)` is the only query returning `data` + `html` (M8). **Delete:** `delete(mailbox, id)` mutation, but M9: *"Incorrect mailbox/id combinations will still return true"* — unverifiable success. **Polling:** no push; M5 advises *"Retrieving a list of messages for a mailbox more often than once every ten seconds or so is wasteful."* **Message format:** GraphQL JSON with `id`, `ip`, `helo`, `date`, `mailfrom`, `rcptto`, `headerfrom`, `subject`, `data` (raw SMTP), `html` (M11). |
| **Privacy** | **Disqualifying.** M13 verbatim: *"you should have no expectation of privacy when sending messages to your Maildrop inbox"*; *"Any message sent to Maildrop can be read by any user"*; *"Every inbox on Maildrop is available to the public"*; *"There are - by design - no security measures to sign into Maildrop and view email messages"*; *"Do not send sensitive information to Maildrop"*; *"While it may be unlikely that someone can guess a random inbox, there is no guarantee that other people don't have access to your email messages"*. Aliases are *"not secure"* — the algorithm is *"public, and can be easily reverse engineered"*. M13 also: *"Connections to Maildrop are logged"*. A verification code/OTP is exactly the sensitive content this policy excludes. |
| **Website-origin CORS — MEASURED INDEPENDENTLY** | **OPEN.** Real Chrome 158, page origin `http://127.0.0.1:55331`. Preflight `OPTIONS /graphql` → `204` with `access-control-allow-origin: *`, `access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE`, `access-control-allow-headers: content-type`. Documented `POST` → `200` with `access-control-allow-origin: *` and body `{"data":{"status":"operational"}}`. Raw output in §3.1. |
| **Extension host-permission behavior — MEASURED INDEPENDENTLY** | **Not separately measured against an unpacked MV3 extension in this worker** — `NOT MEASURED — browser tab used a plain HTTP origin, not an extension context; no extension fixture was in this worker's ownership.` The measured ACAO `*` means host permissions are not required for reads; extension-only use adds no capability and does not change the privacy verdict. |
| **Throttling / errors / liveness** | 429 with backoff documented (M5). Verbatim live read of the documented example mailbox `inbox(mailbox:"testing")` with **no auth** returned `200 {"data":{"inbox":[]}}` (§3.1) — evidence of a public, unauthenticated read, **not** of real incoming mail. `status` → `{"data":{"status":"operational"}}` (§3.1). Greylisting: M1 says a new sending mail server gets a temporary failure and most retry within 15 min. |
| **Live delivery** | **NOT VERIFIED.** No mailbox was provisioned, no external sender was used, and none of the reads above proves reception. Counts: provider count **1**; free active domain count **1** (`maildrop.cc`); provisioned domains **0** (no provider create operation exists); domains with verified real incoming mail **0**. |
| **Decision — website** | **REJECTED.** CORS is open and a developer API is invited, but every inbox is public by design and the provider explicitly says not to send private information (M13). SpectreMail's core use case is verification mail/OTPs; this cannot be made private by a random local part (M13 says guessing is only "unlikely", with "no guarantee"). |
| **Decision — extension** | **REJECTED**, same reason; no extension-only mitigation exists. |

---

## 2. Decision row — official Temp-Mail.org (Privatix, RapidAPI)

| Field | Finding (retrieval date 2026-11-22 unless stated) |
|---|---|
| **Provider / version / docs / terms URLs** | Temp-Mail.org, official API **v1 (current)** as listed on T2. Official pages T1–T4; RapidAPI listing T2. This is **only** `temp-mail.org`; `temp-mail.io`/`tempmail.lol` etc. were not examined. |
| **Free eligibility, signup, key, card, quotas, pricing, attribution** | API is **Freemium via RapidAPI** (T2). Plans shown verbatim: `$0.00 BASIC`, `$19.00 PRO`, `$59.00 ULTRA`, `$99.00 MEGA`; T2 states *"Note that this API is free to use but has a limit of 30 requests per second."* A RapidAPI account/key is required: browser probe with no key → `401 {"message":"Invalid API key. Go to https://docs.rapidapi.com/docs/keys-and-key-rotation for more info."}`; with a dummy non-secret key → `403 {"message":"You are not subscribed to this API."}` (§3.2). Per-plan numeric quotas and attribution clauses are **NOT MEASURED — RapidAPI endpoint detail and plan cards require sign-in.** Website premium (not API): T3 lists `$10` monthly / `$60` yearly via paddle.com. |
| **Permitted vs prohibited third-party / competitive use** | **REVIEW REQUIRED — conflicting official statements.** T2 (RapidAPI listing) says: *"This API purpose is to automate QA tasks of the registration process and help to independent developers to create own apps and services that require temporary email functionality."* T3 (provider's own Terms) says: *"You agree to only access TEMP-MAIL data through the TEMP-MAIL website."* A public API listing inviting apps and a terms clause limiting access to the website cannot both be read as a clear grant; **no permission is assumed.** T3 additionally forbids sensitive data: *"You agree not to use the public TEMP-MAIL system to receive, store, or view emails containing private or confidential information"* and *"You agree, not use temporary emails for registering important accounts or receiving sensitive data."* |
| **Live domain discovery / pagination / free-vs-premium flags / retired / expiry** | A **documented `GET Domains list` endpoint exists** (T2 endpoint list: *"GET Domains list"*, *"Get domains list"*) but is gated behind `X-RapidAPI-Key`; endpoint detail (params, host, response) is *"Not Authorized"* without sign-in. T1: *"Get any email address using our domain names"* and *"You can generate any email address using our domain names without API notification - just think of it as username@our_domains"*. T3 distinguishes a **free domains list** (free feature) from **premium domains** (*"we maintain special list on domains for premium users, which is not-blacklisted and checked for quality every day"*). Pagination, free/premium flags in API responses, retired status and API expiry fields: **NOT MEASURED — requires a subscribed key.** Retention is published, not API-reported: T1 *"automatically delete all incoming email messages within 1-2 hours (self-destroyed)"*; T3 free *"we store emails for 2 hours only"*, premium *"1 month"*. |
| **Create / auth / restore / list / read / delete / polling / formats** | **Create = invent `username@domain`** (T1: *"You can generate any email address using our domain names without API notification"*). **Auth = user-owned RapidAPI key** (`X-RapidAPI-Key`; gateway `privatix-temp-mail-v1.p.rapidapi.com` discovered via X2 and confirmed by the live 401/403 above). **Restore:** reading uses the **MD5 hash of the address** — T2 endpoint docs: `GET Get emails`, path parameter `md5` *"String. email address hash"*; overview *"You make a request to the API with md5 hash of mail address."* There is no secret token; anyone who knows/guesses the address can hash it. **List/read/delete:** T2 endpoint list `Get emails`, `Get one message`, `Source message`, `Get one attachment`, `Get message attachments`, `Get message attachments (legacy)`, `Delete message`, `Domains list`. Formats from T2: `/format/xml/`, `/format/json/` (overview also lists `/format/jsonp/`, `/format/php/`, `/format/html/`). T1: JSON message with *"body, subject, date, attachments"* or raw base64. **Polling:** no push documented. Sender restrictions (T1): *"Government services and major financial institutions cannot send messages to you, nor can you read messages from abuse@, webmaster@, contact@, postmaster@, hostmaster@, admin@."* |
| **Privacy** | **Disqualifying on the free/public service.** T3 verbatim: *"Any email sent through TEMP-MAIL may or may not be available for viewing, may be altered, and is immediately viewable by ANY user of the system"*; *"any email you send to TEMP-MAIL … will become public domain once in the TEMP-MAIL system with no expectation of privacy for email content"*; *"You agree not to use the public TEMP-MAIL system to receive, store, or view emails containing private or confidential information."* Premium offers *"100% Private address with full ownership"* and *"Enhanced privacy and security"* (T1/T3) but is paid. Endpoint addressing by unsecreted MD5 of the name means privacy rests on name unguessability only. |
| **Website-origin CORS — MEASURED INDEPENDENTLY** | **OPEN; not the blocker.** Real Chrome 158, origin `http://127.0.0.1:55331`, gateway `https://privatix-temp-mail-v1.p.rapidapi.com/request/domains/`: no-key GET → `401` with `access-control-allow-origin: http://127.0.0.1:55331`, `access-control-allow-credentials: true`, and a broad `access-control-expose-headers`; preflighted GET with a dummy key → `403` and readable body. Raw output in §3.2. **CORS would permit a browser call; the key requirement and terms are what block it.** |
| **Extension host-permission behavior — MEASURED INDEPENDENTLY** | **Not separately measured against an unpacked MV3 extension in this worker** — `NOT MEASURED — no extension fixture in this worker's ownership; only a plain-HTTP tab origin was used.` Since the gateway reflects ACAO to arbitrary origins, host permissions are not needed for network reach; they would not solve the key or terms problem. |
| **Throttling / errors / liveness** | Documented 30 req/s (T2). Measured errors: 401 invalid key, 403 not subscribed, 404 `{"message":"API doesn't exists"}` for the wrong gateway slug, 429 `{"message":"Too many requests"}` on the wrong path (§3.2). Historical direct hosts `api.temp-mail.org` and `api2.temp-mail.org` both fail with `ENOTFOUND` (Node-only, §3.3) — no surviving no-key direct endpoint was found. |
| **Live delivery** | **NOT VERIFIED.** No mailbox provisioned, no external sender, no key. Counts: provider count **1**; free active domain count **NOT MEASURED** (domains list requires a subscribed key; free-tier domain count cannot be read); provisioned domains **0**; domains with verified real incoming mail **0**. |
| **Decision — website** | **REJECTED (free) / NEEDS AUTHORIZATION (premium).** A user-owned API key cannot be shipped in browser code, and no approved credential-delivery design exists; the free service's own terms forbid the sensitive-data use and expose all mail publicly. CORS openness does not change this. |
| **Decision — extension** | **REJECTED (free) / NEEDS AUTHORIZATION (premium).** An extension could hold a user-entered key, but that is an unapproved credential-delivery design, and the terms conflict on third-party access (REVIEW REQUIRED). Premium would additionally need payment and an authorization decision. |

### Free domain source without a user-owned key or paid plan

**Answer: NO for both providers.**

- Maildrop has no domain list to gate: the single domain `maildrop.cc` is literal and free, but *"free"* here means *"public"* — it is not a usable source for verification mail (M13).
- Temp-Mail.org's **only** machine-readable domain source is the RapidAPI `Domains list` endpoint, which returned 401/403 without a subscribed key (§3.2). The historical direct hosts do not resolve (§3.3). The free *website* lets a person see a free domain list (T3), but that is UI, not an authorized API source for a third-party client, and T3 restricts access to the website. **No permitted free, key-less, machine-readable domain source was found.**

---

## 3. Independently measured browser evidence (verbatim)

Tool: T3 `browse` in a dedicated tab group `provider-research-maildrop-tmo`, Chrome/158.0.0.0 on Windows 11. Probe origin served by an ephemeral local HTTP server on **port 55331** (never 4173): `C:\Users\Edison\AppData\Local\Temp\opencode\maildrop-tmo-cors-server.js`. Tab group and server were closed/stopped after measurement. All tabs and the server belonged to this worker; other workers' tab groups were not touched.

### 3.1 Maildrop — real-browser CORS and no-auth public read

`browse.eval` on `http://127.0.0.1:55331/`:

```json
{
  "origin": "http://127.0.0.1:55331",
  "simpleGet": { "ok": false, "status": 400,
    "body": "{\"errors\":[{\"message\":\"This operation has been blocked as a potential Cross-Site Request Forgery (CSRF). Please either specify a 'content-type' header (with a type that is not one of application/x-www..." },
  "preflightPost": { "ok": true, "status": 200, "acao": null,
    "body": "{\"data\":{\"status\":\"operational\"}}\n" },
  "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36"
}
```

`browse.network` capture (raw headers; the JS-side `headers.get` returned `null`, so the wire capture is authoritative):

```text
POST https://api.maildrop.cc/graphql   (Origin: http://127.0.0.1:55331, sec-fetch-mode: cors, sec-fetch-site: cross-site)
  response 200
  access-control-allow-origin: *
  content-type: application/json; charset=utf-8
  body: {"data":{"status":"operational"}}

OPTIONS https://api.maildrop.cc/graphql
  access-control-request-headers: content-type
  access-control-request-method: POST
  origin: http://127.0.0.1:55331
  response 204
  access-control-allow-origin: *
  access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
  access-control-allow-headers: content-type
```

No-auth read of the documented example mailbox (no token, no cookie):

```json
{
  "publicInbox": {
    "acao": null,
    "body": "{\"data\":{\"inbox\":[]}}\n",
    "status": 200
  }
}
```

**Reading:** CORS is fully open to a third-party web origin; the API performs no authentication; `inbox(mailbox:"testing")` is readable by anyone. This is live wire evidence of a public-inbox model, **not** proof of real delivered mail.

### 3.2 Temp-Mail.org RapidAPI gateway — real-browser CORS and key gate

Gateway host `privatix-temp-mail-v1.p.rapidapi.com` was discovered from X2 (third-party client constant) solely to aim this measurement; the official T1/T2 pages name RapidAPI and gateway `rapidapi.com` but hide endpoint detail behind sign-in.

`browse.eval` from `http://127.0.0.1:55331/`:

```json
{
  "simpleGetNoKey": {
    "status": 401, "ok": false,
    "acao": "http://127.0.0.1:55331",
    "headers": [
      ["access-control-allow-credentials", "true"],
      ["access-control-allow-origin", "http://127.0.0.1:55331"],
      ["access-control-expose-headers", "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, access-control-allow-origin, ..."],
      ["content-type", "application/json"],
      ["server", "RapidAPI-0.1.0"],
      ["x-rapidapi-proxy-response", "true"],
      ["x-rapidapi-region", "AWS - ap-southeast-1"]
    ],
    "body": "{\"message\":\"Invalid API key. Go to https:\\/\\/docs.rapidapi.com\\/docs\\/keys-and-key-rotation for more info.\"}"
  },
  "preflightDummyKey": {
    "status": 403, "ok": false,
    "acao": "http://127.0.0.1:55331",
    "body": "{\"message\":\"You are not subscribed to this API.\"}"
  }
}
```

Other probes from the same origin:

```json
{
  "https://temp-mail.p.rapidapi.com/": { "status": 404, "acao": "http://127.0.0.1:55331", "body": "{\"message\":\"API doesn't exists\"}" },
  "https://temp-mail.p.rapidapi.com/request/domains/format/json/": { "status": 429, "acao": "http://127.0.0.1:55331", "body": "{\"message\":\"Too many requests\"}" },
  "https://api.temp-mail.org/request/domains/format/json": { "error": "TypeError: Failed to fetch" }
}
```

**Reading:** the gateway reflects ACAO to an arbitrary origin and permits credentials, so browser CORS is not the obstacle. The obstacle is a valid user-owned RapidAPI key/subscription (401/403). No secret was used or stored; the dummy header value was the literal non-credential `probe-no-key`.

### 3.3 Node-only reachability (NOT browser evidence)

```text
$ node -e "... fetch(api.temp-mail.org/request/domains/format/json) ..."
https://api.temp-mail.org/request/domains/format/json => ERROR TypeError fetch failed ENOTFOUND
https://api2.temp-mail.org/request/domains/format/json => ERROR TypeError fetch failed ENOTFOUND
```

**Reading (Node-only):** the historical direct hosts do not resolve on 2026-11-22. This is reachability evidence only and is not used as CORS/browser evidence.

### 3.4 Official doc text captured in the real browser (RapidAPI T2)

Read from the JS-rendered RapidAPI page in my own tab (verbatim `innerText` excerpts):

```text
API Version  v1 (current)
Temp Mail  Freemium  (131)  9.9 Popularity  100% Service Level  147ms Latency  N/A Test
Subscription plans
$0.00 / BASIC
$19.00 / PRO
$59.00 / ULTRA
$99.00 / MEGA
Note that this API is free to use but has a limit of 30 requests per second.

Endpoints:
GET Delete message | GET Source message | GET Get message attachments (legacy)
GET Get one message | GET Get one attachment | GET Get message attachments
GET Get emails | GET Domains list

GET Get emails  — "Check and get a list of emails for a mailbox"
Path Parameters: md5 *  String. email address hash
Gateway URL rapidapi.com  X-RapidAPI-Key  Not Authorized
```

Also captured: *"This API purpose is to automate QA tasks of the registration process and help to independent developers to create own apps and services that require temporary email functionality."* and *"You make a request to the API with md5 hash of mail address."*

---

## 4. Boundary between measurement and claim (what this report does NOT establish)

- **No live incoming mail was received by any mailbox in this research.** All `inbox`/`status` reads are liveness/format evidence only. Per `docs/GOAL.md` §3/§8, **LIVE DELIVERY NOT VERIFIED** for both providers.
- **No full domain inventory.** Neither provider exposed a key-less, paginated domain list; counts above are deliberately partial and dated.
- **No extension-context (MV3) measurement** by this worker; both rows say so explicitly rather than inferring from the open CORS result.
- **No per-plan numeric quotas or attribution clauses for the RapidAPI API** — those sit behind sign-in and were not guessed.
- **No formal Maildrop ToS** was located; the developer-invitation text is marketing, and competitive-repackaging permission is REVIEW REQUIRED.
- **Terms can change.** Every quoted term/price is a 2026-11-22 reading and should be re-read before any integration decision.
- This worker **owns only this report file**. No product code, tests, `docs/PROVIDERS.md`, AGENTS.md, ROADMAP, OpenSpec artifact, workflow, design record or token file was modified.

---

## 5. Worker return packet

- **Files changed:** `docs/provider-research/maildrop-temp-mail-org.md` (this file) only.
- **Branch:** `research/maildrop-temp-mail-org`, pushed with upstream tracking at start.
- **Checks run:** official-source fetches (M1–M13, T1–T3, X1–X2), real-Chrome CORS probes from `http://127.0.0.1:55331/` (§3.1, §3.2, §3.4), Node-only DNS reachability (§3.3). No repository test/build gate was run — this is a documentation-only research change; the orchestrator owns verification.
- **Decisions:** Maildrop website **REJECTED**, extension **REJECTED** (public-inbox privacy). Temp-Mail.org website **REJECTED (free) / NEEDS AUTHORIZATION (premium)**, extension **REJECTED (free) / NEEDS AUTHORIZATION (premium)**; third-party permission **REVIEW REQUIRED** due to conflicting official statements.
- **Blockers / unknowns:** no permitted free key-less machine-readable domain source for either provider; RapidAPI per-plan quotas and attribution behind sign-in; no MV3 measurement by this worker; no external sender for live delivery.
- **One-line summary of what was not verified:** real incoming mail, extension-context behavior, and key-gated RapidAPI plan details were not verified.
