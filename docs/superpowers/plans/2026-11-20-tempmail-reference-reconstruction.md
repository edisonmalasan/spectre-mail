# Temp Mail reconstruction — implementation plan

> **For agentic workers:** This plan was executed inline. Steps used checkbox tracking.

**Goal:** Rebuild `apps/web`'s rendered UI to match `https://temp-mail.org/en/`'s
header → dark hero/dashed panel → light four-pill toolbar → light inbox with dark
table header and illustrated empty state, while preserving the existing provider,
session, clipboard, parsing and storage behaviour and SpectreMail's identity.

**Architecture:** Four small presentational modules (`AppHeader`, `ActionToolbar`,
`EmptyInbox`, `clipboard`) plus a compact `Address` and a table-head-aware `Inbox`,
composed by a reduced `App`. All layout lives in `apps/web/src/styles.css` with
token-only values. Informational sections were removed rather than hidden.

**Tech stack:** TypeScript 5.9.3, React 19.3, Vite 7.3.6, Vitest 3.2.7, Playwright 1.63.

**Spec:** `docs/GOAL.md` (approved direction) and
`docs/superpowers/specs/2026-11-20-tempmail-reference-reconstruction-design.md`.

## Global constraints

- No literal colour, radius, spacing or type size in `apps/web/src/styles.css`.
- No remote origin, webfont, image request, `transition`, or suppressed focus ring.
- Every rendered `className` must be matched by a stylesheet selector.
- Single `@media (max-width: 34rem)` breakpoint; `grid-template-columns` present.
- Motion stays on `.address__value`, `.inbox-row`, `.code` with `materialise` and
  the reduced-motion stop.
- No new provider call; every control calls an existing callback.
- The user's GOAL supersedes the old "one Copy control" / "five regions" /
  informational-section constraints.

## Review focus

- Desktop/split/mobile geometry within ~8px of the measured reference for major
  band boundaries (header, hero, toolbar, inbox).
- No horizontal overflow at 390px; address wraps at `@`, never mid-domain.
- All four toolbar controls reach real behaviour; both Copy controls share one
  clipboard write.
- Empty/populated inbox, message open/back, loading and failure states still work.
- No prohibited informational headings remain on the main page.
- Focus rings, contrast pairs, and token-only styling survive the rebuild.

## Tasks (completed)

1. **Reference inspection** — live DOM + screenshots at 1440×900, 956×885, 390×844;
   reference analysis written.
2. **Shared clipboard** — `clipboard.ts` with one `copyAddressToClipboard`.
3. **Header** — `AppHeader.tsx` with centred Wordmark and truthful side facts.
4. **Toolbar** — `ActionToolbar.tsx` with four real pill controls and inline icons.
5. **Empty state** — `EmptyInbox.tsx` with the envelope-in-ring illustration.
6. **Address** — compact mono pill with round Copy, `@` break, live status.
7. **Inbox** — shared dark SENDER/SUBJECT/VIEW header in all states, illustrated
   empty state, rows and message view preserved.
8. **App** — reduced to the reference hierarchy; informational sections deleted.
9. **Styles** — token-only reference geometry, responsive 2×2 toolbar, single
   INBOX label on mobile, focus and motion contracts preserved.
10. **Tests** — obsolete section tests removed; surviving tests retargeted; new
    assertions for the toolbar, empty state and absence of removed headings.
11. **Verification** — typecheck, lint, format, unit suite, browser tier, build,
    and side-by-side visual comparison at all three viewports.
