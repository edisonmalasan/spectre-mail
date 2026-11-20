# Production UX reconstruction + dynamic multi-domain — implementation plan

> REQUIRED SUB-SKILL for execution: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox tracking.

**Goal:** Fix the six recorded UX defects, demote the provider badge, and add
dynamic, honestly-sourced multi-domain support where the browser can reach a provider.

**Architecture:** Website components/CSS for A/B/D/F; a nullable timestamp through
core→providers→UI for E; a generation-id + stable-layout hook and `pruneTo` fix for
C/D; a `Domain` contract + catalog and Mail.tm domain-scoped creation for multi-domain.

**Tech stack:** TypeScript 5.9, React 19, Vite 7, Vitest 3, Playwright 1.63.

**Spec:** `docs/GOAL.md`; design at `docs/superpowers/specs/2026-11-20-production-ux-multidomain-design.md`.

## Global constraints

- Browser-only, no backend/proxy, no API key or shared token in browser code.
- No invented domains; only domains returned by a provider's supported API.
- No fabricated timestamps; missing date is `null` and renders "Date unavailable".
- Preserve focus rings, token-only styling, motion/reduced-motion, no remote assets.
- Do-not-touch: `docs/PROVIDERS.md`, `.github/workflows/`, archived changes, `.agents/skills/`.

## Review focus

- Address field dimensions must not change on Copy (measure before/after).
- Toast auto-dismisses and announces; keyboard activation works; failure reported.
- Double-click Change issues one create; stale response cannot overwrite newer state.
- Open message disappears when a poll returns empty; Back returns to inbox.
- No `1970` in rendered output; missing date shows fallback.
- Domain list comes from an API call, deduped, active/expiry filtered, and every
  selectable domain can actually create a mailbox.

---

### Task 1: Address field + Copy feedback (A, B)

**Files:** `apps/web/src/Address.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`,
`apps/web/e2e/surface-hierarchy.spec.ts`, `apps/web/src/App.test.tsx`.

- [ ] Write failing browser test: at 390px the address is one line (clipped) and the
      field's bounding box is identical before and after Copy; run, see it fail.
- [ ] Rewrite `Address.tsx`: remove `<wbr>` split and `overflow-wrap`, render the full
      address as one text node in a `nowrap` clipped scroller; `title` and `aria-label`
      carry the full value; focus/scroll reveals the tail. Replace the in-flow status with
      a fixed toast rendered from `App`, with a temporary checkmark on the button.
- [ ] Add auto-dismiss timer in `App` (state resets after a short delay, cleared on
      unmount and mailbox change); keyboard activation and failure path retained.
- [ ] Retarget/delete the wrap test; assert one text node, unbroken `textContent`,
      stable geometry, toast dismissal, and accessible announcement.
- [ ] Run the tests; commit.

### Task 2: Timestamp normalization (E)

**Files:** `packages/core/src/message.ts`, `packages/providers/src/guerrilla.ts`,
`packages/providers/src/mailtm.ts`, `packages/providers/src/conformance.ts`,
`packages/providers/src/fixtures.ts`, `apps/web/src/InboxRow.tsx`,
`apps/web/src/MessageView.tsx`, and their tests.

- [ ] Write failing tests: a message with missing/invalid date maps to `null` and
      renders "Date unavailable", never an ISO epoch.
- [ ] Change `receivedAt` to `number | null`; make both adapters return `null`;
      format only non-null values in the UI (no `new Date(0)`), including row + reader.
- [ ] Add a conformance case that forbids `0`/epoch for missing dates; keep fixtures
      with valid dates and add one missing-date fixture.
- [ ] Run tests; commit.

### Task 3: Stable mailbox switching + stale state (C, D)

**Files:** `apps/web/src/useMailboxSession.ts`, `apps/web/src/App.tsx`,
`apps/web/src/ActionToolbar.tsx`, `packages/mailbox/src/opened.ts`,
`packages/mailbox/src/session.ts`, their tests.

- [ ] Write failing tests: double Change → one create; a stale create response cannot
      overwrite the newer mailbox; open message clears when a listing becomes empty;
      address/inbox stay mounted while generating.
- [ ] Add a generation counter to the hook: each `run()` takes a token; responses from
      older tokens are ignored; in-flight `replace` is coalesced; Change disabled while
      generating with an in-button progress state.
- [ ] Keep the ready-state surfaces mounted during `creating` (overlay/status only),
      so layout does not collapse; publish a distinct "changing" indication.
- [ ] Make `opened.pruneTo` clear `state` when the open message is no longer listed.
- [ ] On failure keep the old mailbox and show retryable feedback.
- [ ] Run tests; commit.

### Task 4: Structured message reader (D)

**Files:** `apps/web/src/App.tsx`, `apps/web/src/Inbox.tsx`, `apps/web/src/styles.css`,
`apps/web/e2e/*.spec.ts`.

- [ ] Replace the sibling "message below table" with a reader panel that takes the
      inbox panel's place while open: sender, subject, received (nullable fallback),
      readable body, codes, links, attachments if present, and Back to inbox.
- [ ] Ensure changing/deleting/empty state clears the selection (Task 3 covers state).
- [ ] Add browser assertions for the panel structure and Back; commit.

### Task 5: Domain contract + catalog + Mail.tm (multi-domain)

**Files:** `packages/core/src/provider.ts`, `packages/core/src/mailbox.ts`,
`packages/providers/src/contract.ts`, `packages/providers/src/mailtm.ts`,
`packages/providers/src/manager.ts`, `packages/providers/src/conformance.ts`,
`packages/providers/src/fixtures.ts`, extension/web config, their tests.

- [ ] Add `Domain { id, name, provider, active, expiresAt? }` and `listDomains()` to
      `MailProvider`; `createMailbox(domain?)`; optional `getCapabilities()`.
- [ ] Implement paginated, deduped, active/expiry-filtered `listDomains()` in Mail.tm;
      domain-scoped `createMailbox`; Guerrilla keeps provider-assigned address.
- [ ] Add an in-memory catalog with bounded TTL refresh and empty-on-failure; no
      persisted domain list, no manual domain strings in production code.
- [ ] Update scripted providers, contract assertions, conformance fixtures, and the
      extension config test; keep website on Guerrilla (only browser-reachable provider).
- [ ] Run tests; commit.

### Task 6: Domain picker in Change + badge removal + hierarchy (F, §3, §6)

**Files:** `apps/web/src/AppHeader.tsx`, `apps/web/src/ActionToolbar.tsx`,
`apps/web/src/App.tsx`, `apps/web/src/styles.css`, website tests/specs.

- [ ] Remove the prominent "Guerrilla Mail" header pill; keep truthful facts.
- [ ] Add a small Change popover listing catalog domains (or "Automatic — no
      browser-reachable provider exposes domains" when empty); selecting one creates a
      mailbox on that exact domain; errors are concise and retryable.
- [ ] Raise address/lede/empty-state type and add an intermediate breakpoint for
      the 956px viewport; keep dark hero / light toolbar / light inbox segmentation.
- [ ] Update tests that pin the badge and one-provider copy; assert the picker's
      truthful empty state and the absence of provider advertising.
- [ ] Run tests; commit.

### Task 7: Verification + report

- [ ] Run `pnpm verify` (typecheck/lint/format/test/build).
- [ ] Run the website browser tier at 1440×900, 956×885, 390×844 with mouse and
      keyboard for Scenarios A–I; record real output.
- [ ] Run the extension browser tier to confirm no regression.
- [ ] Independent code review; fix Critical/Important findings.
- [ ] Write the final report (deliverables A–F) with status.
