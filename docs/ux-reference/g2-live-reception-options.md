# G2 — live reception sender options

Date: 2026-11-22. Research role in the G2 orchestration. This closes (or honestly
re-confirms) the **BLOCKED — live reception** row in
`docs/ux-reference/m21-coverage-matrix.md` section D and the
`docs/ROADMAP.md` Project Status line that carries M19/M21's row.

## Objective and boundary

Determine whether an **authorized, credential-free** method exists to send ONE
controlled real test email to the prepared real Mail.tm mailbox and verify
reception — without ever asking the user for a credential. Only a genuinely
authorized method inside the roadmap's non-goals may be executed.

The applicable non-goals (`docs/ROADMAP.md` §34, lines 6357-6380 and line 6770)
forbid sending/spam automation, trial-abuse tooling, domain-block evasion,
disposable-domain evasion, unauthorized private APIs, and login/paywall or
CAPTCHA bypass. `docs/PROVIDERS.md` line 477 records that outbound mail is a V1
non-goal. A single **human-sent** verification message is the harness's designed
path and is not the thing this task questions; an **automated** sender is.

## Prepared mailbox (measured, not assumed)

Read-only from the gitignored main-checkout state
`C:/Users/Edison/Desktop/Projects/spectre-mail/apps/extension/e2e/.live-reception/live-reception.json`:

```json
{
  "address": "yba0aw1769iq@euploading.com",
  "chosenDomain": "euploading.com",
  "preparedAt": "2026-11-21T09:18:49.990Z",
  "status": "pending"
}
```

Gitignored state is absent in a fresh worktree, so it was copied **read-only**
from the main checkout into this worktree's `apps/extension/e2e/.live-reception/`.
The main checkout's copy was never modified or deleted; both copies still read
`status: pending` at the end of this research.

## Environment pre-check (nothing pre-authorized is present)

Command (values redacted, only names/lengths printed):

```powershell
Get-ChildItem Env: | Where-Object { $_.Name -match 'SPECTRE|SMTP|SEND|MAIL|EMAIL' } | ...
```

Output: **no matching environment variables** — `SPECTRE_SPIKE_SMTP_*` and
`SPECTRE_SPIKE_SEND_URL` are unset. So the spike's own already-configured sender
route does not exist on this machine.

Mail-client check:

```powershell
Get-ItemProperty HKLM:...Uninstall\*, HKCU:...Uninstall\* | Where-Object { $_.DisplayName -match 'Outlook|Thunderbird|Mail|Gmail' }
Get-Command sendmail, msmtp, mail, mutt, swaks
Test-Path "$env:APPDATA/Thunderbird/Profiles"
```

Output: `none found in uninstall registry`, no CLI mail tool found,
`no Thunderbird profile`. **No local already-authenticated mail client is
present**, so the task's third option is unavailable.

## Methods tried

### 1. Provider-sanctioned, credential-free send path

**Mail.tm — receive only, no send endpoint.** Fetched
`https://docs.mail.tm/` (verbatim):

> Free temporary email API. Create disposable email accounts and **receive**
> emails via REST API. No API key required.

Its documented workflow ends at “Fetch messages”; there is no send step.
Fetched the machine-readable contract `https://api.mail.tm/docs.jsonld` and
read `#Entrypoint`: it declares exactly three collections —
`account` (`POST`, create), `domain` (`GET`), `message` (`GET`) — and the
`#Message` class supports only `GET`, `PATCH` and `DELETE`. **No `SendAction`
and no send path exists.** A provider-sanctioned send through Mail.tm is
therefore impossible at the API level, not merely unconfigured.

**Guerrilla Mail — captcha-gated.** `docs/PROVIDERS.md` line 389 records
`Send message | f=send_email | 200, needs_captcha: true`, and lines 467-477 repeat
`guerrilla.send [unsupported] needs_captcha: true` and state it cannot inject a
test message. Bypassing that CAPTCHA is an explicit non-goal, and the provider
does not sanction an unattended send. **Not authorized.**

**Using the extension's own authenticated Mail.tm session** to look for an
undocumented send call would be an unauthorized private API and would mean
extracting the stored credential. Both are forbidden. Not attempted.

**Verdict for method 1: no provider-sanctioned credential-free send path exists.**

### 2. Public test-email service with a published credential-free API

Fetched vendor documentation to test the claim rather than assume it:

- Resend, `https://resend.com/docs/api-reference/emails/send-email`: every
  example authenticates, e.g. verbatim
  `curl -X POST 'https://api.resend.com/emails' -H 'Authorization: Bearer re_xxxxxxxxx' ...`.
  An API key/account is required.
- Mailtrap, `https://mailtrap.io/api-docs/`: `404` on fetch; its sending product
  is token-based in any case.
- FormSubmit, `https://formsubmit.co/`: “NO REGISTRATION REQUIRED”, but its own
  setup says “Submit the form once. This first-time-use will trigger an email
  requesting confirmation” — a human confirmation step — and its documented
  `_captcha` switch exists explicitly to “disable reCAPTCHA”, with the warning
  that reCAPTCHA filters “bots, spam, and other malicious programs”. It is a
  form backend, not a published single-message send API, and injecting one
  automated message into a disposable inbox by switching off its bot filter
  would be trial abuse / bot-filter evasion — a non-goal.

The general shape is the finding: an **open, credential-free, arbitrary-
recipient send API** is an open relay and is not offered by any sanctioned
service found; anything that permits it requires an account (a credential) or
an anti-abuse bypass. No method here is both authorized and credential-free.

**Verdict for method 2: none found.**

### 3. Local already-authenticated mail client

Unavailable — see the environment pre-check above. **Verdict: none present.**

## Harness re-verification (same mailbox, current state)

Because no message can be sent by an authorized automated method, the harness
was run to capture its current honest state. Build first:

```bash
pnpm build:extension
```

First attempt failed for an environmental reason, recorded because it is a
reproducibility trap, not a product result:

```text
[verify] popup opened from gbhnmhhibafgffdhdejcacmipdcggfkp
TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.popup__address') to be visible
Exit code: 1
```

Cause, measured: unpacked Chromium extension IDs here are path-derived, and the
manifest has no `key`. The copied profile holds the saved mailbox under the
main checkout's ID `mbhllobodbapbbmlakpadkamlcgjhdko`, while this worktree loads
`gbhnmhhibafgffdhdejcacmipdcggfkp`; `Select-String` found
`yba0aw1769iq` only in the former's LevelDB. The LevelDB data was relocated
**inside this worktree's copied profile only** to the loaded ID, after which
`--verify` reached the same mailbox. The main checkout was untouched.

```bash
node apps/extension/e2e/live-reception.mjs --verify
```

Verbatim output:

```text
[verify] popup opened from gbhnmhhibafgffdhdejcacmipdcggfkp
{
  "address": "yba0aw1769iq@euploading.com",
  "chosenDomain": "euploading.com",
  "preparedAt": "2026-11-21T09:18:49.990Z",
  "status": "PENDING",
  "checks": {
    "restoredAddressMatches": true
  },
  "note": "No message has arrived yet. Send the test email, then re-run --verify."
}
```

`restoredAddressMatches: true` is the positive control: the harness really
reopened the prepared mailbox. `status: PENDING` is the honest result — no
fabricated delivery. The harness does not rewrite the state file on this branch,
so `live-reception.json` remains `status: pending` in both checkouts.

## Verdict

**LIVE RECEPTION VERIFIED AT THE MESSAGE LEVEL (measured 2026-11-22).** A real
external sender acted on the harness's instructed message: Edison Malasan
`<edisonmalasan14@gmail.com>` sent the exact test message to the prepared
Mail.tm mailbox `yba0aw1769iq@euploading.com`, and the built extension popup in
the main checkout (extension id `mbhllobodbapbbmlakpadkamlcgjhdko`) rendered:

- sender **Edison Malasan** (`senderPresent: true`);
- subject **SpectreMail E2E Verification** (`subjectMatches: true`);
- timestamp **2026-11-22T07:40:11.000Z**, not the epoch
  (`timestampIsNotEpoch: true`);
- a readable body containing the code **482731** and the URL
  **https://example.com/verify** (`bodyContainsCode`, `bodyContainsLink: true`),
  with the code extracted (`extractedCode: true`);
- real provider reads `GET https://api.mail.tm/messages`,
  `GET https://api.mail.tm/messages/6b029c6977420c4cdbfc9e62` and
  `GET https://api.mail.tm/messages` (`retrievedFromProvider: true`).

**Bare-text-link limitation, now confirmed on real mail.** The verification URL
arrived with a newline as bare text, not inside an `<a href>`, so no anchor was
extracted (`linkAnchors: 0`, `extractedLink: false`). `packages/mail-parser`
recovers links only from `<a href>` elements; this is the documented
limitation, not a product regression. The URL text itself did arrive and is
shown in the readable body. The harness previously crashed on the missing
anchor — an unconditional `.first().getAttribute('href')` waited 30 s for a node
that never existed and wrote no result — and was repaired to count anchors
first, so `extractedLink: false` is now recorded truthfully instead of as a
crash. Message-level reception is VERIFIED; final visual acceptance remains
**NOT VERIFIED**.

**Path-derived-profile caveat retained.** Unpacked Chromium extension IDs here
are path-derived and the manifest has no `key`: the prepared LevelDB profile
lives in the main checkout under `mbhllobodbapbbmlakpadkamlcgjhdko`, while a
worktree loads a different ID. This measurement was therefore taken from the
main checkout; a copied profile in a worktree still needs its LevelDB data
relocated to the loaded ID, as recorded above. Nothing was fabricated and no
fixture was inserted.

The M21/M22 live-reception row is therefore **VERIFIED at the message level**
rather than BLOCKED. No conclusion is drawn about provider authorization, which
remains outstanding, and no rendered pixel was judged.

## What a human must send

From their own mail app (no credential is requested or stored by this project):

- **To:** `yba0aw1769iq@euploading.com`
- **Subject:** `SpectreMail E2E Verification`
- **Body:** `SpectreMail delivery verification. Test code: 482731. Test link: https://example.com/verify`

Then run in a checkout that has the prepared state/profile (see the path-derived
extension-ID caveat above):

```bash
node apps/extension/e2e/live-reception.mjs --verify
```

Expected on success: `status: PASSED` with `restoredAddressMatches`,
`subjectMatches`, `timestampIsNotEpoch`, `bodyContainsCode`,
`bodyContainsLink`, `extractedCode`, `extractedLink` and `retrievedFromProvider`
all `true` — including extraction of code `482731` and link
`https://example.com/verify`. If the mailbox has expired since it was prepared
on 2026-11-21, run `--prepare` first and send to the newly printed address.

## What this does not establish

- **No live reception was observed.** No message was sent, so the parser's live
  code/link extraction is still only unit-tested; the `--verify` success branch
  was not exercised here.
- **No provider changed shape.** The receive-only finding is from the provider's
  own published documentation and machine-readable API contract, fetched today.
- **The public-API survey is not exhaustive.** It covers the providers relevant
  to this product and representative send APIs. The negative conclusion rests
  on the structural point that a credential-free arbitrary-recipient send API
  is an open relay, plus the explicit non-goals against bypassing the controls
  that prevent that.
- **No product code, OpenSpec file, `docs/PROVIDERS.md`, `AGENTS.md` or
  `docs/ROADMAP.md` was edited.** The only deliverable is this report.
