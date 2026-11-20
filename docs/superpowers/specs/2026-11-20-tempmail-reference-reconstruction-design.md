# Temp Mail reference reconstruction — design

**Date:** 2026-11-20
**Status:** Approved direction (the user supplied `docs/GOAL.md` as the approved design and instructed that work continue without stopping for approval questions).

## Intent

Rebuild the rendered UI of `apps/web` so that a person looking at it sees the same
structure as `https://temp-mail.org/en/`: a dark header, a dark hero containing a
compact dashed panel with the address pill and a one-sentence heading, a light
four-button action strip, and a light inbox with a dark table header and a graphical
empty state. SpectreMail keeps its name, spectral mark and purple accent, and all
working behaviour (provider, clipboard, polling, code/link extraction, storage).

This is a reconstruction, not a redesign. The reference is the visual source of
truth. Where an existing project rule contradicts it (single Copy control, five
required regions, the informational sections), that rule is superseded by the
user's explicit instruction in `docs/GOAL.md` §2 and §5.

## Measured reference (live browser, 2026-11-20)

Captured with the `browse` extension in the user's real Chrome; screenshots in
`C:\Users\Edison\AppData\Local\Temp\opencode\ref\` (`ref-desktop2`, `ref-split2`,
`ref-mobile2`). Playwright is blocked by Cloudflare on this host and was not used
as the reference instrument.

- Header: full-width `#21232a`, 79px tall; store links left, logo centre, account
  items right. Store/subscription items are nonessential and unavailable here, so
  the real page keeps truthful side metadata and does not render dead links.
- Hero band: `#21232a`, 310px tall (from header bottom to the light strip).
  - Dashed panel: 556 × 169 px, `2px dashed #383b44`, `border-radius: 10px`,
    `padding: 30px 0`, centred.
  - Heading: mono, 20px, weight 700, white, centred — "Your Temporary Email Address".
  - Field: 400 × 60 px pill, `background: rgba(255,255,255,0.04)`,
    `border-radius: 30px`, `padding: 4px`, with the address at 20px and a green
    circular copy button at the right.
  - Descriptive copy: three centred lines of muted mono beneath the panel.
- Light toolbar strip: white, ~78px tall, four pill controls each 160 × 52 px,
  `border-radius: 25px`, `background: #f6f7f9`, subtle shadow, mono 16px/500,
  left icon, labels Copy / Refresh / Change / Delete. At 956px and 390px the four
  wrap to a 2×2 grid.
- Inbox: light grey background; centred container ~720px wide. Dark header bar
  `#1e2027`, 54px tall, mono 16px/700 white labels SENDER / SUBJECT / VIEW.
  Empty state: centred envelope-with-circular-arrow illustration, "Your inbox is
  empty" (mono 20px, muted) and "Waiting for incoming emails" (mono 16px, muted).
  At 390px the header collapses to a single "INBOX" label.
- At 390px the hero field's actions move below the field and the toolbar becomes 2×2.

## Approach

Replace the page shell in `apps/web/src/App.tsx` with the reference hierarchy and
add three small presentational modules plus their styles:

1. `AppHeader.tsx` — header row with the existing `Wordmark` in the centre and
   truthful side metadata. No dead store/premium links.
2. `ActionToolbar.tsx` — the four real pill controls, each wired to an existing
   callback. The toolbar `Copy` and the in-field `Copy` share one clipboard action.
   `Delete` performs the device-side clear (the provider cannot delete a mailbox);
   the label and accessible name make that scope explicit.
3. `EmptyInbox.tsx` — the reference empty-state illustration and copy.
4. `styles.css` — replace the page layout rules with reference-matched geometry,
   using declared tokens only (no literal colours, radii, spacing or type sizes).
   Add the toolbar/empty-state/table styles and the 2-column responsive rules.

Preserve: the existing `Address`, `Inbox`, `InboxRow`, `MessageView`, and session
hooks; the clipboard action; provider integration; code/link extraction; storage.
Remove from the rendered page: `Ready`, `MailboxLifetime`, `LocalData`,
`RecentMailboxes`, `Diagnostic`, `Steps`, `Reasons`, `ExtensionPreview`,
`PageFooter`, and the `data-region`/`PAGE_ORDER` five-region contract.

Tests that pin the removed contract are rewritten to pin the new one. The
`page-composition`, `website-client` and `visual-system` OpenSpec capabilities are
amended in one change to describe the reconstructed page.

## Deviations (explicit, not hidden)

- No App Store / Google Play / Virtual Number / Premium links: unavailable, and
  dead controls are forbidden. Truthful metadata occupies those positions.
- No QR-code control: the product has no QR feature.
- `Delete` clears this device's saved address (and starts a fresh one) rather than
  deleting anything provider-side; Guerrilla Mail exposes no deletion API.
- The reference's long marketing paragraphs below the hero are replaced by the
  one truthful sentence the reference leads with; the rest is unrelated content
  the goal requires removed.
- Dynamic address values are masked in visual comparisons.

## Constraints

- Token-only styling: no literal colour/radius/spacing/type value in `styles.css`.
- Every rendered className must be matched by a stylesheet selector.
- Exactly one element may carry the accent fill unless the requirement is amended;
  the toolbar's green action is the reference's own accent, not SpectreMail's purple.
- Keyboard focus must remain visible and use the declared focus token.
- No network or provider call may be added; all controls call existing callbacks.
