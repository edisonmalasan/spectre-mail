# Mail.gw — independent recheck (2026-11-23)

**Worker:** M25 Worker C (research). **Base:** `origin/main` at `0418d60401f2facfdb5099a237c88f81ce2c8704`, verified 2026-11-23. **Branch:** `docs/mailgw-mailtm-recheck`, pushed with upstream tracking before any edit. **Investigation date:** 2026-11-23 (Asia/Shanghai, UTC+08:00); UTC timestamps are given for every probe. **Predecessor:** `docs/provider-research/mailgw.md` (2026-11-22), read-only for this recheck.

**Evidence vocabulary:** MEASURED = an instrument on this machine produced the quoted output; DOCUMENTED = quoted from the provider's own page; INFERRED = interpretation, labelled as such; NOT VERIFIED / BLOCKED = no measurement exists. **No credential, token, password or shared secret was requested, generated, logged, sent or stored in this recheck. No account was created.**

## 1. Headline result

**The API host is still unreachable on 2026-11-23.** All three arms failed before any HTTP response existed: local `curl` (TCP connect refused), the independent `webfetch` service (transport error), and a real Chrome 158 ordinary page (fetch `TypeError: Failed to fetch`, top-level navigation `net::ERR_CONNECTION_REFUSED`). **No `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods` or any other response header from `api.mail.gw` was observed.** Therefore **CORS status is NOT MEASURED** — this report does **not** claim that Mail.gw's CORS was measured, denied, or granted. Website CORS is **BLOCKED**, which is not the same claim as "CORS blocked".

## 2. Official documentation, re-read verbatim (DOCUMENTED)

Every fetch below was issued between the shell timestamps `2026-11-23T05:45:00.0127413+08:00` (UTC `2026-11-22T21:45:00Z`) and `2026-11-23T05:49:36.0208951+08:00` (UTC `2026-11-22T21:49:36Z`). The docs pages themselves answer `HTTP/1.1 200 OK` with `Date: Sun, 22 Nov 2026 21:49:18/19 GMT`, `Server: cloudflare` (MEASURED, local `curl -sS -I`), so the documentation host is reachable while the API host is not.

| Source                    | URL                                                                                   | Result 2026-11-23                                      |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Official API docs         | `https://docs.mail.gw/`                                                               | 200; footer still reads "Updated at Mon, Jan 16, 2023" |
| Official OpenAPI document | `https://api.mail.gw/docs.json`                                                       | Transport error on both network paths; UNREADABLE      |
| Official FAQ              | `https://mail.gw/en/faq/`                                                             | 200                                                    |
| Official privacy policy   | `https://mail.gw/en/privacy/`                                                         | 200; "Last edited: 20.04.2020"                         |
| Terms routes              | `https://mail.gw/en/terms/`, `https://mail.gw/en/tos/`, `https://docs.mail.gw/terms/` | All three re-confirmed `http_code=404`                 |

### 2.1 Access and quota (verbatim, `https://docs.mail.gw/`)

> "Available completely free of charge and without restriction."
>
> "The general quota limit is 8 queries per second (QPS) per IP address."
>
> "Keep in mind that no API keys are required to use our service."

### 2.2 Third-party / legal / integration language (verbatim, same page)

> "Usage of our API for illegal activity is strictly prohibited."
>
> "It is forbidden to sell programs or earn from it that exclusively uses our API (for example, creating a competing temp mail client and charging for it's usage)."
>
> "We would appreciate any legal integrations to make usage of our service, please let us know to be added to the list."
>
> "Sign up only on sites that you have acquired permission to."
>
> "Our API is compatible with Mail.tm API libraries as the only difference would be the base URL."

The page's Integrations section renders one row: `Dart — https://pub.dev/packages/mailgw_client`. The docs footer still reads "Updated at Mon, Jan 16, 2023"; no newer revision date is published (DOCUMENTED).

**INFERRED (not a permission finding):** the express prohibition is on _selling / earning from_ a client that _exclusively_ uses this API. SpectreMail is free and multi-provider, so that literal example does not plainly cover it — but the docs give **no affirmative grant** for a free competing client, and no terms page exists at any of the three routes tried. Per GOAL §3 this is **REVIEW REQUIRED / PERMISSION REQUIRED**, never PASS. Nothing in this recheck changes that.

### 2.3 Privacy and lifetime (verbatim)

From `https://mail.gw/en/faq/`:

> "It is completely anonymous: personal data, address itself and emails are deleted after 10 minutes."
>
> "How long do you store incoming messages? We do store messages for only 10 minutes."
>
> "How to extend the life time of temporary mail? Unfortunately, we do not provide this feature."
>
> "Do you keep and renew your domains used by this service? No, we aren't renewing domains that were used by this service. If you need a constant account just use Mail.tm."
>
> "How do I send an email? Unfortunately, we do not provide this feature."

From `https://mail.gw/en/privacy/` ("Last edited: 20.04.2020"):

> "Mail.gw Service does not store your IP-address at all."
>
> "All emails and data temporarily stored on our service are permanently deleted."
>
> "Access to your data will only be provided to you personally and only for the lifetime of the temporary email address."

**INFERRED:** a 10-minute mailbox/message lifetime and non-renewed domains are documented constraints that would need truthful surfacing in any UI; they are not measured behaviour and are not a reason to reject on merits.

## 3. Network path 1 — local machine (`curl` / DNS / TCP) (MEASURED)

All commands were run in PowerShell on Windows 11. No credentials were used. The first DNS command used an invalid `-Type A,AAAA` argument and failed with a parameter-binding error; it was corrected into two separate calls immediately afterwards. Both attempts are recorded rather than only the successful one.

```text
PS> Get-Date -Format o
2026-11-23T05:45:24.7542714+08:00

PS> Resolve-DnsName api.mail.gw -Type A,AAAA -ErrorAction SilentlyContinue
Cannot bind parameter 'Type'. Cannot convert value "A,AAAA" to type
"Microsoft.DnsClient.Commands.RecordType" ...            [harness error, not a provider result]

PS> curl.exe -sS -i -m 25 https://api.mail.gw/domains
curl: (7) Failed to connect to api.mail.gw:443 after 3481 ms: Could not connect to server
curl exit=7

PS> curl.exe -sS -o NUL -m 25 -w 'http_code=%{http_code} connect=%{time_connect}s total=%{time_total}s remote=%{remote_ip}:%{remote_port} ssl_verify=%{ssl_verify_result}\n' https://api.mail.gw/domains
curl: (7) Failed to connect to api.mail.gw:443 after 3531 ms: Could not connect to server
http_code=000 connect=0.000000s total=3.530823s remote=:-1 ssl_verify=0
curl exit=7

PS> Get-Date -Format o
2026-11-23T05:45:44.1368752+08:00
```

Corrected DNS / TCP / controls, starting `2026-11-23T05:46:05.2527296+08:00` and ending `2026-11-23T05:46:38.0785504+08:00`:

```text
--- DNS A ---
api.mail.gw    A   900  Answer  135.181.20.167
--- DNS AAAA ---
api.mail.gw AAAA   900  Answer  2a01:4f9:4b:44df::2
--- TCP 443 to 135.181.20.167 ---
TcpTestSucceeded=False RemoteAddress=135.181.20.167 RemotePort=443
--- control: curl docs.mail.gw ---
http_code=200 connect=0.150701s total=0.401755s remote=104.21.92.177:443
--- control: curl api.mail.tm/domains ---
http_code=200 connect=0.291366s total=0.844957s remote=49.12.20.211:443
--- curl -sS -i -m 25 https://api.mail.gw/docs.json ---
curl: (7) Failed to connect to api.mail.gw:443 after 3337 ms: Could not connect to server
curl exit=7
```

**No HTTP status line, no response headers and no response body from `api.mail.gw` were received on this path.** `http_code=000` means no response object existed; ACAO is therefore unobservable, not "absent".

## 4. Network path 2 — independent `webfetch` service (MEASURED, distinct network path)

```text
fetch GET https://api.mail.gw/domains
-> {"error":{"type":"unknown","message":"Transport error (GET https://api.mail.gw/domains)"},"content":[]}

fetch GET https://api.mail.gw/docs.json
-> {"error":{"type":"unknown","message":"Transport error (GET https://api.mail.gw/docs.json)"},"content":[]}

fetch GET https://docs.mail.gw/            -> 200, full page quoted in §2
fetch GET https://mail.gw/en/faq/          -> 200, full page quoted in §2
fetch GET https://mail.gw/en/privacy/      -> 200, full page quoted in §2
```

The same service that reaches `docs.mail.gw` and `mail.gw` cannot reach `api.mail.gw`. This is **two distinct network paths** (local machine and the fetch service) failing, plus the browser arm in §5. It is scoped to these tools on 2026-11-23 and is **not** a global-outage claim.

## 5. Network path 3 — real Chrome, ordinary third-party page (MEASURED)

The in-app `browser` relay was disconnected (`[browser.disconnected]`) and the `browse` extension reported `connected:false, pairingState:"paired-offline"`, so neither relay was retried. Instead a **real locally installed Chrome 158.0.8127.37** was driven directly over CDP, with no Playwright dependency and no credentials:

```text
script: C:\Users\Edison\AppData\Local\Temp\opencode\mailgw-cdp-probe.mjs
command: node C:\Users\Edison\AppData\Local\Temp\opencode\mailgw-cdp-probe.mjs
chrome: C:\Program Files\Google\Chrome\Application\chrome.exe --headless=new
        --remote-debugging-port=9333 --user-data-dir=<fresh temp profile>
startedAt: 2026-11-22T21:47:50.000Z   finishedAt: 2026-11-22T21:48:08.181Z
```

The probe opened `https://example.com` as an **ordinary page** (not an extension page, not a `chrome-extension://` document), verified `location.origin === "https://example.com"`, and issued these fetches:

```json
{
  "at": "2026-11-22T21:47:53.242Z",
  "origin": "https://example.com",
  "domainsCors": {
    "label": "GET /domains mode:cors",
    "thrown": "TypeError: Failed to fetch",
    "message": "Failed to fetch",
    "name": "TypeError",
    "ms": 3337
  },
  "domainsNoCors": {
    "label": "GET /domains mode:no-cors",
    "thrown": "TypeError: Failed to fetch",
    "message": "Failed to fetch",
    "name": "TypeError",
    "ms": 248
  },
  "docsJsonCors": {
    "label": "GET /docs.json mode:cors",
    "thrown": "TypeError: Failed to fetch",
    "message": "Failed to fetch",
    "name": "TypeError",
    "ms": 3075
  },
  "docsControl": {
    "label": "GET https://docs.mail.gw/ mode:cors",
    "ok": true,
    "status": 200,
    "type": "cors",
    "acao": null,
    "acah": null,
    "acam": null,
    "ms": 559
  },
  "exampleControl": {
    "label": "GET https://example.com/ mode:cors",
    "ok": true,
    "status": 200,
    "type": "basic",
    "ms": 1
  }
}
```

Top-level navigation in the same tab:

```text
Page.navigate https://api.mail.gw/domains
errorText: net::ERR_CONNECTION_REFUSED
ended at:  chrome-error://chromewebdata/
```

**Narrow conclusion:** the cross-origin request fails, but `mode:'no-cors'` — which does **not** perform a CORS check — fails identically, and top-level navigation reports connection refused. The failure occurs **before CORS is evaluated**. The `docs.mail.gw` control shows the same Chrome can read a cross-origin 200 response. **No ACAO/ACAH/ACAM value exists to quote; website CORS is NOT MEASURED.** This is a real Chrome (headless mode) ordinary page, not the user's logged-in browser session; that substitution is stated rather than hidden. All tabs/processes/profiles created by the probe were closed and deleted by the script.

## 6. Classifications

Primary classification is technical; the permission column is a separate, non-technical claim and is never rounded into a PASS.

| Surface       | Primary classification  | Why                                                                                                                      | Permission status (separate)                                                                                                                                                                                |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website**   | **TECHNICALLY BLOCKED** | Host unreachable on all three arms; no API operation; CORS NOT MEASURED. No provider adapter may be added or advertised. | **PERMISSION REQUIRED / REVIEW REQUIRED** — no affirmative grant for a free competing multi-provider client; no terms page at three routes. Not CLEARLY PERMITTED, not PROHIBITED.                          |
| **Extension** | **TECHNICALLY BLOCKED** | Same unreachable host; no extension probe possible, so host-permission behaviour is NOT VERIFIED.                        | **PERMISSION REQUIRED / REVIEW REQUIRED** on the same evidence. A `https://api.mail.gw/*` pattern would be required by repo rules _if_ this were ever integrated; that is a design rule, not a measurement. |

**CLEARLY PERMITTED: no. PROHIBITED: not established** (the quoted prohibition is narrower than this product and no terms page resolves it). **No integration, support claim, or adapter change is made or implied.**

## 7. Counts kept distinct (GOAL §3/§8 vocabulary)

| Measure                             | Value on 2026-11-23   | Provenance                                                                                      |
| ----------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Candidate providers in this recheck | **1** (Mail.gw)       | This document only                                                                              |
| Permitted integrations              | **0**                 | Permission unresolved; REVIEW REQUIRED                                                          |
| Live domains                        | **NOT MEASURED**      | Host unreachable; the 2026-11-22 report likewise measured none. No domain count may be reported |
| Created mailboxes                   | **0 by this recheck** | No write operation attempted or possible                                                        |
| Domains with verified incoming mail | **0**                 | No mailbox, no delivery attempt, no delivery evidence                                           |

No recorded fixture, documentation example or prior snapshot is presented as a live-domain or delivery measurement.

## 8. Blockers and ambiguities (BLOCKED, not PASS)

1. **BLOCKED — API host unreachable.** TCP/443 and the HTTP layer fail from local `curl`, from the fetch service and from real Chrome. Re-test from another network before further work; do not convert this into a merits rejection.
2. **BLOCKED — CORS and extension host permissions are NOT MEASURED.** A reachable host is a precondition. Do not report "CORS denied".
3. **BLOCKED — third-party/competitive permission.** The docs forbid charging for a client that exclusively uses the API; three terms routes 404. Escalate for written authorization if reconsidered.
4. **NOT VERIFIED — all API operations:** domain pagination, account creation, token, `/me` restore, message list/read/delete, Mercure SSE, throttling. The API description is documentation only.
5. **NOT VERIFIED — privacy/lifetime behaviour:** 10-minute deletion, no IP storage and domain non-renewal are quoted from provider pages dated 2020/2023, not observed.

## 9. What this recheck did NOT verify

Nothing about Mail.gw's live API, domain inventory, CORS policy, extension behaviour, real delivery, or current third-party permission was verified; the only live observations are the connection failures and browser network errors recorded above. No code, UI, spec or protected document was changed by this worker.
