# SpectreMail Development Roadmap

> **Status:** Draft approved for implementation planning  
> **Repository:** `edisonmalasan/spectre-mail`  
> **Architecture:** Monorepo — website + extension + shared packages  
> **Initial delivery strategy:** Website first, extension immediately after the shared core is stable  
> **Initial infrastructure target:** $0 paid backend infrastructure  
> **Website provider:** Guerrilla Mail — the only provider reachable from a browser web page  
> **Extension providers:** Mail.tm (primary) + Guerrilla Mail (fallback) — roles changed by M0, see `Project Status`
> **Visual direction:** Spectral Swiss Utility  
> **Current public name status:** `SpectreMail` is a project codename until final naming/brand checks are complete

---

## Project Status

> This block is the root orchestrator's progress ledger. It is **not** the behavioral
> source of truth — `openspec/specs/` and the active OpenSpec change artifacts are.
> Reconcile this block against Git and OpenSpec before trusting it in a later session.

**Roadmap cursor:** M0 — Provider Compatibility Spike (**gate satisfied**; awaiting archive)

**OpenSpec change:** `m0-provider-spike` (`openspec/changes/m0-provider-spike/`)

| Milestone | State | Notes |
|---|---|---|
| M0 Provider Compatibility Spike | **verified** | Real external delivery observed on **both** providers. Provider roles decided. Long-run expiry still unverified (no provider advertises a TTL). Gate satisfied. |
| M1 Monorepo Foundation | not started | Unblocked once M0 is archived. A provider-role OpenSpec change is needed first. |
| M2–M15 | not started | — |

**OpenSpec lifecycle stage:** Apply

**Last updated:** 2026-10-02

**Evidence:** `docs/PROVIDERS.md`, produced from spike run
`2026-10-01T18-08-41-251Z` — 36 probes: 26 passed, 6 failed, 3 unsupported,
1 unverified, **including a real external message observed on both providers**.
Re-run the spike before relying on any of it; provider behaviour and terms
change.

### Planning assumptions that M0 disproved

These are recorded because the roadmap below still contains them in several
places. **The observed behaviour wins.** Do not build later milestones on the
original assumption.

| Roadmap assumption | Observed reality |
|---|---|
| Mail.tm is the primary provider for the website | `api.mail.tm` sends `Access-Control-Allow-Origin` only to `https://mail.tm` and `https://api.mail.tm`. A page on our own domain **cannot read it at all**, verified in a real browser. Its terms forbid proxying the API, so there is no compliant workaround. Mail.tm is currently **extension-only**. |
| Guerrilla Mail is the fallback, usable where technically reliable | Inverted. Guerrilla Mail works from a normal web page *and* an extension; it is the only provider the website can use today. |
| "Generate mailbox: 1 action or automatic", "Open app → usable email: a few seconds" | Mail.tm advertises `ratelimit-policy: 1; w=60` on `POST /accounts` — **one mailbox per minute per IP**. Seconds-long generation is not achievable on Mail.tm. |
| "SSE subscription if stable" (M3) and "SSE where reliable" (M6) | Mail.tm has **no working real-time transport**. Five SSE candidate paths returned 404/406 and no WebSocket accepted a connection, despite the provider's marketing claiming SSE. **Adaptive polling is the only option.** |
| Extension requests host permissions for the provider | Silent-failure trap, measured: `https://api.mail.tm` is accepted into the manifest and grants **nothing**; `https://api.mail.tm/*` works. The extension must use the `/*` form and must test it. |
| Mailbox expiry has a knowable TTL | **Unverified for both providers.** No TTL is exposed by either API. `MailboxStatus: expired` must not assume one yet. This gap is unchanged and still open. |
| A harness that reports `unverified` is reporting a provider limitation | **False, and it bit us.** Run `2026-10-01T17-35-14-033Z` reported both delivery checks `unverified` because of two defects in the spike itself: the Mail.tm mailbox was deleted (token revoked → `GET /messages` returns `401`) before delivery polled it, and the Guerrilla address printed to the maintainer was stale after `set_email_user`. Neither was a provider behaviour. Fixed, with an abort-on-`401` guard. |
| A real external verification message can be observed during the spike without a maintainer-supplied credential | **Resolved by maintainer action.** Run `2026-10-01T18-08-41-251Z` observed a real message on both providers. No credential-free *sender* exists, so this always required one manual send. |

### Decision: provider roles (2026-10-02)

Recorded because M0 disproved the roadmap's provider assignment and a
maintainer decision was required to continue.

```text
website:
Guerrilla Mail only

extension:
Mail.tm (primary) + Guerrilla Mail (fallback)
```

Rationale: `api.mail.tm` grants CORS only to its own origins, and its terms
forbid proxying, so no compliant design lets a SpectreMail web page read it.
Mail.tm remains fully functional from an MV3 extension context, where host
permissions bypass CORS, so it stays in scope for the extension. The website
ships on the single provider it can actually reach rather than on a proxy.

Consequences for later milestones:

- The website's provider adapter surface is Guerrilla-only in V1. It must still
  go through the same provider abstraction, so adding a second web-capable
  provider later is additive, not a rewrite.
- The extension carries the provider-fallback logic. The website has no
  fallback path until a second web-reachable provider exists.
- Mail.tm attribution is an **extension-only** product obligation.
- Mail.tm's `POST /accounts` limit of 1 per 60s per IP caps extension mailbox
  creation throughput and must be surfaced, not silently retried.

This decision belongs in an OpenSpec change before M1 begins, so the provider
layer spec (`M3`) and the website/extension specs are written against it rather
than against the superseded assumption.

### M0 gate status

> **Do not begin full UI work until Mail.tm successfully completes the complete
> receive-mail lifecycle.**

**Gate satisfied.** Run `2026-10-01T18-08-41-251Z` observed a real external email
arrive on **both** providers: Mail.tm at `spikemupulgy6gkia@uberip.com` (subject
"TEST", body "TEST M0") and Guerrilla Mail at
`spikemupull2b4vd@guerrillamailblock.com` (body "test m0", delivered as raw
HTML). The complete receive-mail lifecycle is therefore proven with a real
message, not inferred.

This gate was previously reported as **unsatisfied** because the delivery probes
were structurally incapable of passing. Two harness defects caused that — the
Mail.tm mailbox was deleted before delivery polled it (revoking the token), and
the Guerrilla address printed to the maintainer was stale after a rename. Both
were measured against the live API, both are fixed, and both poll loops now abort
and report a harness fault when their own preconditions are unmet — using the
signal each provider actually returns: `401` for Mail.tm, and an `error` key with
no `list` for Guerrilla, whose `auth.success` is `true` even when the session is
dead. These guards are provider-specific and must not be generalised to a provider
that has not been measured the same way. See `docs/PROVIDERS.md` §5.1.

**What remains open.** Mailbox/session expiry is still unverified for both
providers — neither advertises a TTL — so `MailboxStatus: expired` must not assume
one. And delivery is proven from a single sender; reputation with providers that
commonly blocklist disposable domains is untested. Both must be carried into the
provider-layer spec rather than treated as settled.

### Additional provider facts that change later milestones

- **Guerrilla sessions are `sid_token` based, not cookie based.** The provider
  sets `PHPSESSID` but sends `Access-Control-Allow-Origin: *` with no
  `Access-Control-Allow-Credentials`, so a browser cannot send the cookie
  cross-origin. The body-returned `sid_token` is the only workable carrier.
  Persist the token, never a cookie.
- **An unrecognised Guerrilla session is not rejected.** It returns `200` with
  an empty inbox and no auth error, so an expired stored session is
  indistinguishable from a genuinely empty mailbox. The core mailbox manager
  must detect this explicitly.
- **Guerrilla message bodies are raw HTML** while declaring `content_type:
  "text"`. Declared content type must never be trusted; raw HTML must never be
  rendered.
- **mail.tm requires visible attribution** wherever its API is used, and forbids
  reselling it or proxying it. Attribution is a product obligation, not a
  nicety.

---

## 1. Product Direction

SpectreMail is an accountless temporary-email product designed around one core promise:

> **Temporary email without interrupting what you're doing.**

The standalone website will prove and expose the mailbox engine. The browser extension will become the differentiated product by allowing users to generate disposable addresses, receive verification messages, detect OTPs, and continue signup flows without repeatedly switching tabs.

The project must be built so that the website and extension are **two clients of the same shared SpectreMail core**, not two separate implementations.

The long-term target interaction is:

```text
Website asks for an email
        ↓
User chooses SpectreMail
        ↓
Temporary address is inserted
        ↓
Website sends a verification email
        ↓
SpectreMail receives it
        ↓
OTP or verification link is detected
        ↓
User copies/fills the code
        ↓
Signup continues
```

---

## 2. Core Product Principles

1. **No SpectreMail account required in V1**
   - No login
   - No OAuth
   - No cloud profile
   - No personal email required

2. **Local-first SpectreMail state**
   - Mailbox metadata
   - Provider credentials/session data
   - Recent mailbox history
   - User settings
   - Future site-to-mailbox mapping in the extension

3. **Provider-independent architecture**
   - Mail.tm and Guerrilla Mail must sit behind adapters
   - UI components must never directly depend on provider-specific response formats
   - Future providers must be replaceable without rewriting the product

4. **Safe email handling**
   - Incoming email is untrusted
   - Do not render raw provider HTML directly
   - Prefer safe text extraction for V1
   - Do not load remote email images by default
   - No attachments in V1

5. **Useful without AI**
   - OTP detection must be deterministic
   - Verification-link detection must be deterministic
   - AI is not a dependency for core functionality

6. **Minimal permissions**
   - The extension should request only permissions required by active features

7. **No disposable-domain evasion**
   - If a website rejects a temporary-email domain, SpectreMail reports it
   - SpectreMail will not attempt to bypass or conceal temp-mail restrictions

8. **Website-first, not website-only**
   - The website exists to prove the mail engine and provide standalone value
   - The browser extension is the long-term differentiation

---

## 3. Repository Architecture

The project should use one monorepo:

```text
spectre-mail/
│
├── apps/
│   ├── web/
│   └── extension/
│
├── packages/
│   ├── core/
│   ├── providers/
│   ├── mail-parser/
│   ├── storage/
│   └── ui/
│
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── PROVIDERS.md
│   ├── PRIVACY.md
│   └── DESIGN_SYSTEM.md
│
├── tests/
│   └── fixtures/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── .gitignore
├── LICENSE
└── README.md
```

### Dependency rule

```text
apps/web ───────┐
                ├──→ packages/*
apps/extension ─┘
```

Shared packages must never import from `apps/web` or `apps/extension`.

### Shared packages

#### `packages/core`

Owns normalized product logic:

```text
mailbox lifecycle
provider selection
provider health
mailbox manager
message normalization
error normalization
expiration logic
shared types
```

#### `packages/providers`

Owns provider-specific code:

```text
MailTmProvider
GuerrillaMailProvider
future SpectreMailProvider
```

#### `packages/mail-parser`

Owns:

```text
safe text extraction
OTP detection
verification-link detection
message classification helpers
```

#### `packages/storage`

Owns shared storage contracts and platform adapters:

```text
SpectreStorage interface
Web IndexedDB adapter
Extension storage adapter
```

#### `packages/ui`

Owns reusable product UI:

```text
buttons
mailbox card
provider badge
status dot
message row
OTP component
verification-link component
design tokens
```

Do not move marketing-only website sections into the shared UI package.

---

## 4. Recommended Initial Tooling

### Workspace

- pnpm workspaces
- TypeScript
- ESLint
- Prettier
- Vitest
- Playwright for browser-level tests

### Website

- React
- TypeScript
- Vite

### Extension

- React
- TypeScript
- Manifest V3
- Prefer a modern extension build framework if it clearly improves Chrome/Firefox maintainability
- Do not add a heavy framework before extension work actually begins

### Root scripts target

```bash
pnpm dev
pnpm dev:web
pnpm dev:extension
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Initially:

```bash
pnpm dev
```

should run the website.

---

# 5. Milestone Overview

| Milestone | Name | Primary Outcome |
|---|---|---|
| M0 | Provider Compatibility Spike | Prove real incoming mail works in target browser environments |
| M1 | Monorepo Foundation | Establish repository structure and tooling |
| M2 | Shared Domain Model | Define provider-independent mailbox/message types |
| M3 | Provider Layer | Implement Mail.tm + Guerrilla adapters (website: Guerrilla; extension: both) |
| M4 | Mail Parsing Engine | OTP + verification-link detection |
| M5 | Website Core MVP | Working temporary mailbox website |
| M6 | Website Hardening | Storage, errors, accessibility, security |
| M7 | Spectral Swiss Design Pass | Apply approved visual system |
| M8 | Extension Foundation | Manifest V3 shell + shared package reuse |
| M9 | In-Page Email Integration | "Use SpectreMail" inside email fields |
| M10 | Verification Workflow | Notifications + OTP copy/fill |
| M11 | Side Panel + Mailbox Context | Persistent inbox beside webpages |
| M12 | Release Hardening | Security, permissions, tests, docs |
| M13 | Public Beta | Website + Chromium extension |
| M14 | Cross-Browser Expansion | Firefox + Edge |
| M15 | Post-Beta Evaluation | Decide next provider/infrastructure direction |

---

# 6. M0 — Provider Compatibility Spike

## Goal

Before building the full application, prove that the provider workflows we are planning are reliable enough for both the website and future extension.

This milestone is deliberately ugly and temporary. It is a technical experiment, not product UI.

## Required tests

### Mail.tm

Verify:

```text
fetch available domains
create mailbox
authenticate mailbox
list messages
fetch message
receive a real external verification email
delete mailbox if supported
handle provider errors
test realtime/SSE behavior
```

### Guerrilla Mail

Verify:

```text
create or obtain session
obtain temporary address
preserve required session/cookie state
list incoming mail
fetch a message
receive a real external verification email
confirm expiration/session behavior
observe browser/CORS/cookie limitations
```

### Browser environments

Run the tests from:

```text
normal web page
Chrome extension context
```

Firefox may be tested later unless trivial to include now.

## Deliverables

```text
docs/PROVIDERS.md
tests/provider-spike/
```

The provider document should record:

```text
working endpoints
auth/session model
known limits
browser restrictions
message expiration behavior
mailbox expiration behavior
fallback considerations
provider terms that affect the product
```

## Gate

**Do not begin full UI work until Mail.tm successfully completes the complete receive-mail lifecycle.**

Guerrilla Mail may remain a fallback-only implementation if browser restrictions prevent parity.

> **M0 result (2026-10-02).** The browser-restriction outcome landed on the
> *opposite* provider from what this gate anticipated: Mail.tm works fully from a
> Chromium extension and is **unreachable from a normal web page**, while
> Guerrilla Mail works from both. The "complete receive-mail lifecycle" half of
> this gate is now **verified** — run
> `2026-10-01T18-08-41-251Z` observed a real external message on both providers.
> **The gate is satisfied.** The provider roles were re-decided as a result; see
> *Decision: provider roles* in `Project Status`.

If Guerrilla Mail proves unreliable in the website environment:

```text
website:
Mail.tm only initially

extension:
Mail.tm + Guerrilla where technically reliable
```

Do not introduce a fragile proxy merely to force equal behavior.

---

# 7. M1 — Monorepo Foundation

## Goal

Create a clean repository before feature code spreads into the wrong locations.

## Tasks

- Initialize pnpm workspace
- Create `apps/web`
- Create placeholder `apps/extension`
- Create shared package directories
- Add TypeScript base config
- Add linting
- Add formatting
- Add test runner
- Add CI workflow
- Add root scripts
- Add `.editorconfig`
- Add `.gitignore`
- Add basic README
- Add product documentation directory

## Expected structure

```text
apps/web
apps/extension
packages/core
packages/providers
packages/mail-parser
packages/storage
packages/ui
docs
tests
```

## Extension placeholder

Before extension development starts:

```text
apps/extension/README.md
```

should explain:

```text
Extension implementation starts after the website core is stable.
Reusable logic must not be placed under apps/web.
```

## Acceptance criteria

```text
pnpm install        succeeds
pnpm build          succeeds
pnpm test           succeeds
pnpm typecheck      succeeds
pnpm lint           succeeds
pnpm dev:web        starts website
```

---

# 8. M2 — Shared Domain Model

## Goal

Define SpectreMail's own normalized data model before implementing providers.

## Required types

```ts
type ProviderId =
  | "mailtm"
  | "guerrilla";

type MailboxStatus =
  | "active"
  | "expired"
  | "unavailable";

type Mailbox = {
  id: string;
  provider: ProviderId;
  address: string;
  createdAt: number;
  expiresAt?: number;
  credentials: ProviderCredentials;
  status: MailboxStatus;
};

type MessageSummary = {
  id: string;
  mailboxId: string;
  from: string;
  fromName?: string;
  subject: string;
  receivedAt: number;
  unread?: boolean;
};

type Message = MessageSummary & {
  text: string;
  verificationCodes: VerificationCode[];
  verificationLinks: VerificationLink[];
};

type VerificationCode = {
  value: string;
  confidence: number;
};

type VerificationLink = {
  url: string;
  hostname: string;
  confidence: number;
};
```

Provider credentials must be a discriminated type so Mail.tm tokens and Guerrilla sessions are never mixed.

## Required normalized errors

```text
PROVIDER_UNAVAILABLE
RATE_LIMITED
MAILBOX_EXPIRED
AUTH_FAILED
NETWORK_ERROR
MESSAGE_NOT_FOUND
UNSUPPORTED_OPERATION
UNKNOWN_PROVIDER_ERROR
```

## Gate

No React component may ever need to understand Mail.tm JSON or Guerrilla Mail JSON directly.

---

# 9. M3 — Provider Layer

## Goal

Implement each provider behind one contract.

## Contract target

```ts
interface MailProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  checkHealth(): Promise<ProviderHealth>;

  createMailbox(): Promise<Mailbox>;

  listMessages(
    mailbox: Mailbox
  ): Promise<MessageSummary[]>;

  getMessage(
    mailbox: Mailbox,
    messageId: string
  ): Promise<Message>;

  deleteMessage?(
    mailbox: Mailbox,
    messageId: string
  ): Promise<void>;

  destroyMailbox?(
    mailbox: Mailbox
  ): Promise<void>;

  subscribe?(
    mailbox: Mailbox,
    listener: MessageListener
  ): UnsubscribeFunction;
}
```

## Mail.tm adapter

> **M0 constraints (2026-10-01).** Two items below are not implementable as
> written and must be revised in the M3 OpenSpec change:
>
> - `POST /accounts` is limited to **1 per 60s per IP**
>   (`ratelimit-policy: 1; w=60`). Mailbox generation cannot be automatic and
>   instant; the product needs explicit rate-limit handling in the UI, not just
>   in the adapter.
> - **SSE does not exist.** No SSE or WebSocket endpoint is available, so
>   `subscribe?` cannot be implemented for Mail.tm. Polling is the only option.
>
> Mail.tm is also currently **unreachable from a normal web page** — see
> `Project Status` and `docs/PROVIDERS.md`.

Implement:

```text
domain discovery
mailbox creation
authentication token handling
message listing
message fetch
mailbox deletion
health checks
rate-limit handling
SSE subscription if stable   → not available; polling only
```

## Guerrilla Mail adapter

> **M0 constraint (2026-10-01).** Session persistence must store the
> body-returned `sid_token`, **not** the `PHPSESSID` cookie: the provider sends
> `Access-Control-Allow-Origin: *` with no
> `Access-Control-Allow-Credentials`, so a browser cannot send the cookie
> cross-origin. Session expiration must also be detected explicitly, because an
> unrecognised session returns `200` with an empty inbox rather than an error.
> See `docs/PROVIDERS.md`.

Implement:

```text
session creation
cookie/session persistence
address lifecycle
message listing
message fetch
session expiration handling
health checks
rate-limit/error handling
```

## Provider manager

Automatic mode:

```text
try Mail.tm
    ↓
success → create mailbox
    ↓
failure
    ↓
short retry
    ↓
failure again
    ↓
mark degraded
    ↓
try Guerrilla Mail
```

Important:

> Failover applies only when creating a new mailbox.

Existing mailboxes must remain attached to the provider that created them.

## Acceptance criteria

- Both adapters pass the same provider contract tests
- Provider-specific objects stay inside adapter code
- Automatic mode can choose/fallback without UI changes
- Manual provider selection is possible

---

# 10. M4 — Mail Parsing Engine

## Goal

Make incoming mail useful without AI.

## Safe message processing pipeline

```text
provider message
      ↓
normalize
      ↓
extract safe text
      ↓
extract URLs
      ↓
detect OTP candidates
      ↓
detect verification links
      ↓
render SpectreMail data model
```

## OTP detection V1

Prioritize:

```text
4–8 digit codes
```

Boost confidence near words such as:

```text
verification
verify
security code
OTP
one-time
authentication
confirmation
confirm
login code
```

Reduce confidence for values resembling:

```text
prices
dates
phone numbers
order numbers
tracking numbers
postal codes
```

## Verification-link detection

Inspect link text and nearby wording for:

```text
verify
verification
confirm
activate
login
magic
authentication
validate
```

Never silently open a detected link.

Always show destination hostname.

## Fixture suite

Add realistic test messages for:

```text
4-digit OTP
6-digit OTP
8-digit OTP
multiple numeric candidates
HTML-heavy mail
plain-text mail
magic-link mail
order-confirmation mail with misleading numbers
newsletter
password reset
GitHub-style verification
Discord-style verification
generic SaaS verification
```

## Acceptance target

- High detection rate on known verification fixtures
- Low false-positive rate on ordinary transactional email
- Multiple candidates are surfaced instead of pretending certainty

---

# 11. M5 — Website Core MVP

## Goal

Create the first complete user-facing SpectreMail experience.

## First-run flow

```text
open website
    ↓
automatic provider selection
    ↓
create mailbox
    ↓
show address
    ↓
copy address
    ↓
receive mail
    ↓
see message
    ↓
open message
    ↓
copy OTP / open verification link
```

## Required UI

### Header

```text
SpectreMail
provider status
theme
settings
```

### Active mailbox

```text
temporary address
copy
new address
provider
status
expiration
```

### Inbox

```text
sender
subject
time
verification badge
unread state
```

### Message view

```text
sender
subject
safe text
verification codes
verification links
```

### Mailbox history

Allow multiple recent mailboxes where the provider session still permits access.

## V1 features

- Auto-create mailbox
- Copy address
- New mailbox
- Provider selector
- Automatic provider mode
- Inbox refresh
- Realtime update when stable
- Open message
- OTP extraction
- Verification links
- Expiration state
- Local mailbox history
- Clear local data
- Theme toggle

## Explicitly excluded

```text
attachments
outgoing mail
reply
forwarding
user accounts
cloud sync
AI
paid features
custom domains
own mail infrastructure
```

## Acceptance criteria

A user must be able to:

```text
open SpectreMail
receive a working address
use it externally
receive a real message
find the OTP
copy the OTP
return to a recent mailbox
clear local SpectreMail data
```

without registering for SpectreMail.

---

# 12. M6 — Website Hardening

## Goal

Make the website safe and reliable enough to become the reference implementation for the extension.

## Storage

Implement IndexedDB-backed storage for:

```text
mailboxes
provider credentials
preferences
message metadata cache
provider health
```

## Privacy controls

Add:

```text
Forget mailbox
Clear mailbox history
Clear all local SpectreMail data
```

## Error states

Normalize user-facing messages.

Examples:

```text
Provider is temporarily unavailable.
This mailbox has expired.
Too many requests. Retrying shortly.
Can't reach the mail provider.
This message is no longer available.
```

Do not expose raw stack traces or raw API response objects.

## Security

- No raw HTML rendering
- No email JavaScript execution
- No automatic remote image loading
- No attachment handling
- Validate all URLs before presentation
- Sanitize all visible provider-originated strings

## Accessibility

Target:

```text
keyboard navigation
visible focus states
semantic controls
screen-reader labels
sufficient contrast
reduced-motion handling
```

## Performance

Avoid polling unnecessarily.

Prefer:

```text
SSE where reliable
adaptive polling otherwise
pause inbox activity when page is hidden where appropriate
```

> **M0 result (2026-10-01).** No provider offers SSE. Mail.tm's real-time
> endpoints are absent (all candidate paths `404`/`406`; no WebSocket accepts a
> connection). **Design for adaptive polling as the only transport**, and treat
> "SSE where reliable" as dead rather than aspirational. See
> `docs/PROVIDERS.md`.

---

# 13. M7 — Spectral Swiss Design Pass

## Goal

Apply the approved visual direction after the core workflow is functional.

## Direction

**Spectral Swiss Utility**

Primary characteristics:

```text
strong Swiss-style grid
minimal interface
large clean typography
monospace technical details
thin borders
few shadows
generous whitespace
restrained spectral-violet accent
subtle geometric branding
materialize/disappear motion
```

## Suggested visual system

### Surfaces

```text
warm off-white light background
near-black dark background
neutral surfaces
high-contrast text
subtle borders
```

### Accent

Use a restrained spectral violet rather than neon hacker green.

The accent should primarily appear on:

```text
active status
verification codes
selected mailbox
primary action
focus state
brand mark
```

## Typography

Primary:

```text
Geist / Inter / similar grotesk
```

Technical:

```text
Geist Mono / JetBrains Mono / IBM Plex Mono
```

Use monospace for:

```text
email addresses
OTP values
provider diagnostics
technical metadata
```

## Motion

Use motion to support the "spectre" concept:

```text
opacity 0 → 1
blur 6px → 0
translateY 4px → 0
```

for:

```text
new mailbox
incoming message
OTP appearance
```

Avoid:

```text
heavy gradients
glitch effects
Matrix-style visuals
cartoon ghost overload
large neon hacker aesthetics
```

## Website sections

Keep marketing compact:

```text
1. Live product hero
2. Generate → Receive → Discard
3. Why SpectreMail
4. Extension preview
5. Privacy/providers/open-source footer
```

The product itself should remain the main hero.

---

# 14. M8 — Extension Foundation

## Goal

Create a Chromium Manifest V3 extension that reuses the shared SpectreMail core.

## Required surfaces

```text
background service worker
toolbar popup
content script
side panel
extension storage adapter
```

## First extension milestone

The popup should already support:

```text
create mailbox
copy address
view provider
view status
basic inbox count
```

using the same provider/core packages as the website.

## Gate

Do not duplicate provider logic inside the extension.

No files like:

```text
apps/extension/src/api/mailtm.ts
```

should exist if the logic belongs in `packages/providers`.

> **M0 requirement discovered (2026-10-01).** Host permissions **must** use the
> wildcard-path match pattern — `https://api.mail.tm/*`, never
> `https://api.mail.tm`. The slash-less form is accepted into the manifest and
> then grants nothing, so every cross-origin fetch fails with an opaque
> `TypeError: Failed to fetch` and the extension ships looking correct while
> being unable to reach the provider. This was measured, not assumed, and must
> be covered by a test. See `docs/PROVIDERS.md`.

---

# 15. M9 — In-Page Email Integration

## Goal

Create the first browser-native SpectreMail advantage.

## Behavior

When an email input receives focus:

```text
Email
┌────────────────────────────┐
│                            │
└────────────────────────────┘

👻 Use SpectreMail
```

Clicking should:

```text
create or select mailbox
insert address
fire the appropriate input/change events
preserve compatibility with React/Vue-controlled inputs
associate the mailbox with the current site
```

## UX rules

- Do not permanently overlay every email field
- Prefer appearing on focus or explicit user interaction
- Never overwrite existing text without user action
- Allow using:
  - current mailbox
  - new mailbox
  - recently used mailbox for that site

## Site mapping

Store locally:

```text
hostname → mailbox ID
```

Example:

```text
reddit.com → mailbox-123
example.com → mailbox-456
```

This becomes a core extension-specific feature.

---

# 16. M10 — Verification Workflow

## Goal

Complete the browser-native verification flow.

## Incoming mail notification

When likely verification mail arrives:

```text
SpectreMail
Verification code received from example.com

583291
```

## User actions

Support:

```text
Copy code
Open SpectreMail
Fill code
Open verification link
```

## Fill-code rules

- Never silently fill codes
- Require explicit user action
- Prefer detected OTP inputs
- If multiple possible inputs exist, ask the user
- Do not auto-submit forms

## Verification-link rules

- Show destination hostname
- Require explicit user action
- Open in a new tab unless product testing proves another behavior clearly better

---

# 17. M11 — Side Panel + Mailbox Context

## Goal

Make SpectreMail usable without switching away from the active website.

## Side panel

Display:

```text
current mailbox
site association
inbox
new messages
OTP
verification links
recent mailboxes
provider state
```

## Target experience

```text
registration page        SpectreMail side panel
────────────────────     ─────────────────────────
email field              ghost83@...
password field           Inbox

verification code        Example.com
[      ]                  Verification code
                           583291
                          [ Copy ] [ Fill ]
```

## Context behavior

The side panel should understand:

```text
current tab hostname
mailbox associated with current hostname
current mailbox provider
whether verification mail is pending
```

No cloud account is required.

---

# 18. M12 — Release Hardening

## Goal

Prepare website and extension for public beta.

## Security review

Review:

```text
provider credentials
extension permissions
storage boundaries
message rendering
URL handling
content-script injection
site mapping
notification content
clear-data behavior
```

## Permissions review

Every extension permission must answer:

> What user-facing feature requires this?

Remove anything unnecessary.

## Provider review

Before release:

- Re-check Mail.tm API terms
- Re-check Guerrilla Mail API terms
- Re-check rate limits
- Re-check attribution requirements
- Re-check whether public extension distribution is compatible with provider policies

Provider terms may change; do not rely permanently on planning-stage assumptions.

## Privacy documentation

Publish a clear privacy document covering:

```text
what SpectreMail stores locally
what providers receive
what SpectreMail does not collect
how users clear data
provider attribution
message lifecycle limitations
```

## Branding check

Before public release, validate final public name.

`SpectreMail` remains a codename until:

```text
name collision check
domain check
Chrome Web Store search
Firefox Add-ons search
GitHub search
basic trademark risk check
social handle check
```

If the name changes, architecture/package names may remain internal temporarily but public branding should be updated cleanly.

---

# 19. M13 — Public Beta

## Website release

Ship:

```text
standalone temporary mailbox
Guerrilla Mail
OTP detection
verification-link detection
mailbox history
privacy controls
Spectral Swiss UI
```

> **M0 result (2026-10-01) + decision (2026-10-02).** "Mail.tm" was removed from
> the website release list. `api.mail.tm` grants CORS only to its own origins and
> its terms forbid proxying, so a SpectreMail web page can never read it. The
> website ships on Guerrilla Mail alone; Mail.tm stays extension-primary. See
> *Decision: provider roles* in `Project Status`. The website has no provider
> fallback until a second web-reachable provider exists.

## Chromium extension release

Ship:

```text
popup
content-script email integration
OTP notifications
copy/fill flow
side panel
local site mapping
```

## Beta goals

Collect:

```text
mailbox creation success
mail arrival reliability
OTP detection accuracy
provider failure rates
extension compatibility issues
email-field injection failures
site-specific UI conflicts
```

Do not optimize around vanity metrics yet.

---

# 20. M14 — Cross-Browser Expansion

## Firefox

Adapt:

```text
manifest differences
browser namespace differences
permissions
side-panel equivalent strategy
notification behavior
store requirements
```

## Edge

Chromium compatibility should make this relatively straightforward after Chrome stabilizes.

## Shared-extension rule

Do not fork the extension into completely separate Chrome/Firefox repositories.

Keep platform-specific differences behind small compatibility layers.

---

# 21. M15 — Post-Beta Evaluation

## Goal

Decide whether SpectreMail should remain provider-powered or begin owning infrastructure.

Evaluate:

```text
active users
provider reliability
domain rejection rates
provider policy risk
mail volume
support burden
abuse patterns
extension retention
site-integration value
operating cost projections
```

## Possible outcomes

### Outcome A — Continue provider-powered

If:

```text
providers remain reliable
terms remain compatible
usage remains manageable
```

continue improving the product layer.

### Outcome B — Add another provider

If one provider degrades:

```text
MailTmProvider
GuerrillaProvider
ThirdProvider
```

without changing UI architecture.

### Outcome C — Begin own infrastructure

Only if product traction justifies it:

```text
SpectreMailProvider
      ↓
our API
      ↓
our database
      ↓
mail-routing infrastructure
      ↓
our domain
```

This is intentionally not a V1 requirement.

---

# 22. Testing Strategy

## Unit tests

Required for:

```text
OTP detection
verification-link detection
provider normalization
expiry calculations
provider fallback logic
error normalization
storage serialization
```

## Provider contract tests

Every provider must pass equivalent behavior tests:

```text
createMailbox
listMessages
getMessage
health check
expiration handling
```

Optional methods should clearly report unsupported behavior.

## Integration tests

Test real provider lifecycles periodically.

Do not run destructive/high-volume integration tests on every local save.

## Browser tests

Website:

```text
create mailbox
copy address
switch mailbox
open message
copy OTP
clear data
```

Extension:

```text
detect email field
inject SpectreMail affordance
fill email
open popup
receive notification
fill OTP
open side panel
```

---

# 23. CI Gates

Every pull request should eventually require:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Later add:

```text
web Playwright smoke tests
extension smoke tests
provider contract tests with safe mocks
```

Real third-party provider integration tests should be scheduled or explicitly triggered to avoid flaky PRs and accidental API abuse.

---

# 24. Branch and Commit Strategy

## Stable branch

```text
main
```

## Feature branches

Examples:

```text
feat/m0-provider-spike
feat/monorepo-foundation
feat/mailtm-provider
feat/guerrilla-provider
feat/mail-parser
feat/web-mailbox
feat/web-inbox
feat/extension-foundation
feat/email-field-integration
feat/otp-fill
```

## Suggested commit style

```text
chore: initialize SpectreMail monorepo
docs: add architecture and roadmap
test: add provider compatibility spike
feat(providers): add Mail.tm adapter
feat(providers): add Guerrilla Mail adapter
feat(core): add normalized mailbox model
feat(parser): add OTP detector
feat(web): add mailbox creation flow
fix(extension): restore React-controlled email input
```

Avoid a giant first commit containing the entire product.

---

# 25. Pull Request Expectations

Every meaningful PR should answer:

```text
What changed?
Why does this belong in this layer?
What tests were added?
What user flow changes?
Does this introduce new provider coupling?
Does this introduce new extension permissions?
Does this add storage?
Does this affect privacy/security?
```

Provider-specific code outside `packages/providers` requires explicit justification.

---

# 26. Scope-Control Rules

These rules exist to prevent SpectreMail from becoming a generic email platform.

## V1 non-goals

Do not build:

```text
sending email
replying
forwarding
attachments
SMTP hosting
custom domains
SpectreMail accounts
social login
cloud synchronization
AI summaries
AI inbox assistant
premium plan
mobile app
mass account creation
CAPTCHA bypass
trial-abuse tooling
domain-block bypass
disposable-domain evasion
```

A feature should only enter V1 if it materially improves:

```text
get disposable address
receive verification message
find verification information
continue browsing workflow
```

---

# 27. UX Success Criteria

The website should aim for:

```text
Open app → usable email:
a few seconds

Generate mailbox:
1 action or automatic

Copy address:
1 action

See verification code:
immediately highlighted after message arrival

Account creation required:
0
```

The extension should aim for:

```text
Focused email field → disposable address:
1–2 actions

Incoming verification → code copied:
1 action

Incoming verification → code filled:
1 explicit action

Tab switching required:
ideally 0
```

---

# 28. Engineering Success Criteria

Early technical targets:

| Metric | Initial Goal |
|---|---:|
| Healthy-provider mailbox creation success | >95% |
| Incoming message display success | >95% |
| OTP recognition on fixture suite | >90% |
| False OTP suggestions | Low enough not to confuse users |
| Shared provider logic duplicated in apps | 0 |
| SpectreMail accounts required | 0 |
| Paid backend required for MVP | 0 |
| Raw email HTML rendered unsafely | 0 |

These are development targets, not public guarantees.

---

# 29. Privacy Model

SpectreMail should be transparent:

```text
SpectreMail state:
local-first

Incoming mail:
received by selected third-party mail provider

SpectreMail account:
none

Browsing-history database:
none

Ad injection:
none

User-data sale:
none

Analytics:
none initially
```

Do not claim:

> Messages never leave your device.

That is false while third-party providers receive the mail.

Prefer:

> SpectreMail does not require an account and keeps its own mailbox state locally. Incoming mail is processed by the temporary-email provider powering the address.

---

# 30. Provider Independence Exit Strategy

The project should always preserve this evolution path:

```text
V1

Web / Extension
      ↓
SpectreMail Core
      ↓
Mail.tm / Guerrilla
```

Later:

```text
Web / Extension
      ↓
SpectreMail Core
      ↓
SpectreMailProvider
      ↓
our infrastructure
```

The success of this roadmap depends on **never letting provider-specific implementation leak into the product UI**.

---

# 31. Recommended Development Order

The actual order of work should be:

```text
M0  Provider spike
 ↓
M1  Monorepo
 ↓
M2  Domain model
 ↓
M3  Provider layer
 ↓
M4  Parser
 ↓
M5  Functional website
 ↓
M6  Harden website
 ↓
M7  Apply Spectral Swiss design
 ↓
M8  Extension shell
 ↓
M9  Email-field integration
 ↓
M10 Verification workflow
 ↓
M11 Side panel
 ↓
M12 Release hardening
 ↓
M13 Public beta
 ↓
M14 Cross-browser
 ↓
M15 Evaluate own infrastructure
```

The most important sequencing rule is:

> **Do not spend significant time polishing the marketing website before real incoming email works reliably.**

---

# 32. Immediate Next Action

The next implementation task is:

## `M0 — Provider Compatibility Spike`

Create a small technical test harness that proves:

### Mail.tm

```text
create mailbox
receive real email
list message
open message
```

from both:

```text
normal web app
Chrome extension context
```

### Guerrilla Mail

Repeat the same lifecycle while documenting:

```text
session requirements
cookie behavior
expiration
browser restrictions
failure modes
```

At the end of M0, update:

```text
docs/PROVIDERS.md
```

with the actual findings.

Only then proceed to full repository scaffolding and production implementation.

---

# 33. Roadmap Completion Definition

SpectreMail's initial roadmap is considered successfully completed when:

```text
✓ Website is publicly usable
✓ Browser extension is publicly usable
✓ No SpectreMail account is required
✓ Guerrilla Mail works as the website provider
✓ Mail.tm works as the extension's primary provider
✓ Guerrilla fallback works in the extension where technically viable
✓ Provider-specific code is isolated
✓ OTP detection works reliably
✓ Verification links are safely exposed
✓ Browser email-field integration works
✓ Incoming verification notifications work
✓ Side panel provides usable inbox context
✓ Data remains local-first
✓ Privacy behavior is documented
✓ Public branding has been validated
✓ Architecture still permits future own-domain infrastructure
```

At that point the next roadmap should be based on real usage rather than assumptions.

---

## Final Rule

When choosing between:

```text
more features
```

and:

```text
making the disposable-email + verification workflow faster and more reliable
```

choose the second.

SpectreMail should win by making temporary email feel native to the browser, not by becoming a full email client.
