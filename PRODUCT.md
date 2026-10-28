# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: people who need a disposable address instead of their own.** They are
mid-task — finishing a signup, passing a verification step, opening a download
gate, claiming a trial — and the address is a means rather than the point. They
want an inbox they can read immediately, without creating an account and without
handing a real address to a service they have not decided to trust. The category
reference named by the project owner is **temp-mail.org**: an instant throwaway
inbox, no signup, mail read in the browser.

**Two situations, one product.** The website serves the person who wants a tab
holding an address and an inbox. The extension serves the same person _inside
somebody else's page_, where leaving the flow costs the form they were filling.
The extension is not a power-user companion; it is the same user in the moment
the website cannot reach.

**Not confirmed:** a secondary audience (developers automating signups),
enterprise or team use, or any segment beyond the above. None of those is
designed for, and future work should not invent one.

## Product Purpose

SpectreMail gives a person a temporary email address and lets them read what
arrives at it, so they can complete a step that demands an email without
disclosing a real one.

Success is narrow and observable: **the person gets the code or the link they
came for, and their real address never enters the transaction.** Engagement,
retention, and volume are not success criteria, and that is recorded as a
decision rather than an omission — the roadmap forbids optimizing for vanity
metrics before the beta.

## Positioning

**Temporary email that meets the flow instead of interrupting it**, over
measured providers, with no backend.

What a neighbouring disposable-inbox product could not truthfully copy:

- **The extension acts inside the page.** It offers the address in a
  shadow-root control at the moment an email field takes focus, writes a
  one-time code into the page's own field on request, and remembers which
  mailbox was last used with which exact hostname. The website cannot do this,
  and the extension does it without a proxy.
- **A background alarm announces new mail while nothing is open**, naming the
  sender and the subject and never the body.
- **No SpectreMail-operated server, ever.** The provider is contacted from the
  client, and each client's provider set is chosen by what that runtime can
  actually reach: Guerrilla Mail on the website because Mail.tm sends no CORS to
  third-party origins, Mail.tm primary in the extension because host permissions
  reach both. The tempting fix — a relay — is refused as product policy.
- **Provider claims are measured, not assumed.** Every provider behaviour the
  product depends on is recorded against a live probe in `docs/PROVIDERS.md`,
  and where nothing was measured the product does not assert a value.

## Operating Context

- **Runtime:** Chromium, desktop. The extension loads unpacked from
  `apps/extension/dist`; the website is a Vite app served on
  `http://127.0.0.1:5173`.
- **The moment of use:** a third-party signup or verification form the person
  does not want to give a real address to. The extension's surfaces are a popup,
  a side panel, an in-page control inside a shadow root, and a notification. The
  website's surface is one page holding an address, an inbox, a message view,
  and one local-data region.
- **Providers:** two, both reached directly — Mail.tm (extension primary) and
  Guerrilla Mail (website only; extension fallback). Availability is per client,
  not global.
- **What is kept on the device:** mailbox records, a newest-first mailbox
  collection, a `hostname → mailbox id` map, and the ids of messages already
  announced. `chrome.storage.local` for the extension, IndexedDB for the
  website, removable in full from the surface that holds it.
- **What does not exist:** no backend, no account, no analytics, no telemetry,
  no deployment, and no store listing.

## Capabilities and Constraints

Confirmed behaviour future work must preserve:

- A created mailbox is written and offered back on a later visit **only after
  the provider confirms it**; an address the provider merely could not check is
  reported as unconfirmed rather than gone.
- A detected code is copied, and a detected link is opened, **only when the
  person activates that control**. Nothing is submitted and no form control is
  pressed on a person's behalf.
- An in-page fill refuses when it is not the top frame, when the field already
  holds text, or when it cannot name a candidate field; several candidates are
  offered to the person rather than chosen for them.
- A code or a link is **never reported as certain**. Confidence is never rendered
  as a number.
- Provider failure is surfaced with the provider's normalized code rather than
  silently retried or queued.

Constraints:

- **Chromium only, by decision (M14 withdrawn 2026-10-28).** Firefox
  compatibility is unmeasured; Edge was never run. The product must not be
  described as cross-browser.
- **No backend and no provider proxy** — architectural policy, not a terms
  judgement.
- **Polling, not push.** No provider serves a verified push transport; the
  cadence is 5 s while a mailbox's contents change, backing off to 30 s.
- **No invented provider figure.** A provider's declared limit is honoured as a
  floor; a limit nobody published is not estimated on screen.
- **Diagnostics are per-session:** counts and normalized outcomes, held in
  memory, never persisted and never transmitted.
- **No remote asset** in either client's visual layer — no webfont, no CDN, no
  third-party stylesheet.

Explicitly undecided: deployment and hosting, release and store listing, a
support channel, and any published privacy or terms document for the product
itself.

## Brand Commitments

- **Name:** SpectreMail — one word, declared once as `PRODUCT_NAME` in
  `packages/ui/src/name.ts`, and rendered by every surface that names the
  product. `docs/BRANDING.md` owns the surface list.
- **`spectremail.com` is registered by a third party** (created 2020-06-03, no
  nameservers) and is not available. The name may be used for the product; no
  domain claim may be made from it, and DNS-based availability is not evidence
  about it.
- **Voice:** quiet, precise, technical, and explicit about uncertainty. The
  product says what it knows and what it could not check, never reports a
  provider failure as a lost address, and never presents the absence of a
  measurement as a fact.
- **Approved visual direction:** _Spectral Swiss Utility_, recorded and enforced
  in `docs/DESIGN_SYSTEM.md`. It is referenced here, not restated.

## Evidence on Hand

- `docs/PROVIDERS.md` — provider behaviour measured against live APIs, with the
  probe, date, and what each measurement does and does not establish.
- `openspec/specs/` — 190 requirements and 629 scenarios across 15 capabilities,
  re-counted 2026-10-28.
- `apps/web/e2e/` and `apps/extension/e2e/` — 51 website and 98 extension
  Playwright cases against real Chromium: real IndexedDB, a real unpacked
  extension, Chromium's accessibility tree.
- `packages/mail-parser` — a 14-message authored corpus, every fixture marked
  `synthetic: true`.
- `docs/BRANDING.md` — name availability checks across registries and both
  browser stores, with the checks that produced no measurement named as such.
- `docs/BETA.md` — which beta goals are collected, in-session, and which are not
  collectable at all.

**Absences future work must not fabricate:** no users, no testimonials, no case
studies, no benchmarks, no analytics, no press, no store listing, no deployment,
and **no real mail received from any service** — the parsing corpus is written,
not captured, and no screenshot may imply otherwise.

## Product Principles

1. **The person's real address never enters the transaction.** Every surface
   exists to keep it out.
2. **Say what was measured, and say what was not.** Uncertainty is stated, not
   smoothed; a claim broader than its instrument is a defect.
3. **Act only when asked.** Nothing is filled, copied, submitted, or opened
   without the person's own activation.
4. **Be a guest inside somebody else's page.** Offer, do not take over; write
   nothing until an insertion has landed.
5. **No backend.** The honest response to a provider that will not serve a page
   is to not use it there.

## Accessibility & Inclusion

- Every interactive control must be keyboard reachable and draw a visible focus
  indicator this product declared.
- Both colour schemes are declared, not derived, and every ink and identifying
  boundary is held to a contrast ratio.
- Motion is entrance-only and is removed entirely under
  `prefers-reduced-motion: reduce`, not merely shortened.
- Copy is written in English only; no localisation exists yet.
- Not established: testing with a real screen reader or other assistive
  technology. No gate in the repository substitutes for it.
