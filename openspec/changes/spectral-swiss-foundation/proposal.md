# Proposal

## Why

The website has **no stylesheet**. Measured, not inferred: the only `.css` file anywhere
under `apps/` or `packages/` outside `node_modules` is jsdom's own
`default-stylesheet.css`. `apps/web` renders correct semantic markup — sections with
`aria-labelledby`, real `<button>` elements, `<time dateTime>`, `role="status"` — and zero
visual design. `packages/ui` exists and is a documented file with no behaviour.

That absence has been load-bearing in a specific, checkable way, and M6's audit already
found it: `visible focus states` and `reduced-motion handling` sat in M6's Accessibility
block and were **undeliverable there**, because both are CSS. `docs/ROADMAP.md` moved
ownership to M7 rather than pretending M6 had done them. **M7 is that milestone.**

Three things are now true that were not, and each of them changes what M7 owes:

- **The project owns a real browser suite.** `browser-verification` added
  `pnpm test:browser`: 6 Playwright specs in real Chromium against the built site. So the
  roadmap's sentence *"there is no browser-automation suite in the workspace"* is already
  corrected. What remains true — and what M7 now makes actionable — is that **nothing in
  that suite asserts a computed colour or a rendered focus ring**.
- **The no-network property is a promoted requirement, not a convention.**
  `build-and-verification` requires that a browser check contact no third-party origin.
  A CDN webfont would break it. See D3, which is the sharpest decision in this change.
- **`tests/architecture/boundaries.test.ts` cannot see a stylesheet.** `SOURCE_EXTENSIONS`
  is `[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]`. The moment M7 ships CSS, every
  client scan and every shared-package scan **silently skips the file that is now the
  largest piece of shipped source in the repository**. Shipping the milestone without
  fixing that would be the silent-skip failure M5 slice 1 was bitten by, arriving through
  a door one file type over.

## What Changes

- **A token layer in `packages/ui`**, and it is a *decision about ownership*, not a
  convenience. The roadmap's approved design assigns design tokens to that package, M8
  becomes its second consumer, and `SHARED_PACKAGES` already contains `"ui"` so the
  existing boundary rules hold the line. A palette living in `apps/web` would need moving
  the moment a second client appears.
- **A stylesheet for the existing page**, adding `className` hooks to the components and
  **changing no structure**: no element added, removed, or reordered. 113 unit tests and 6
  browser specs assert on accessible names and `data-testid`, and a class hook is the whole
  of what a stylesheet needs to address markup.
- **`.css` joins `SOURCE_EXTENSIONS`**, so the boundary rules read shipped stylesheets.
  Widening a scan is not free in this repository — it is the recorded cause of a real false
  positive (`set-cookie` in `packages/providers` read as a cookie jar) — so every existing
  rule is re-proven against the new extension rather than assumed unaffected.
- **Three new boundary rules, all about CSS**: no stylesheet reaches a remote origin; no
  stylesheet suppresses a focus indicator; every `var(--x)` a stylesheet reads resolves to
  a declaration. The third exists because a mistyped custom property **renders as nothing**,
  silently, and a screenshot review does not reliably catch it.
- **Contrast is verified where contrast can be computed; focus is verified where focus can
  only be rendered.** WCAG relative-luminance arithmetic is a pure function over the token
  values, so it belongs in `packages/ui`'s unit tests with no browser. A focus ring is a
  property of computed pixels, so it belongs in the browser tier, where a spec reads the
  resolved outline. **These are different claims and the change states them as two.**
- **`website-client`'s *"This milestone builds structure, not visual design"* is modified
  in the delta, with the reason attached.** Its scenario reads *"the milestone SHALL NOT
  have introduced a design token or theme system."* The first stylesheet makes that false
  the day it lands. A requirement that outlives its own falsification is worse than one
  that dies with it. Its surviving clause — **state is never conveyed by colour alone** —
  is kept verbatim and becomes load-bearing, because the accent now appears on active
  status and must never be the only signal.
- **`packages/ui` component extraction is deferred, with a reason** (D11), not silently
  dropped. The five marketing sections are deferred, with a reason, and one of them is
  recorded as **blocked on M8**.

## Scope

**In:** tokens, surfaces (light and dark), typography, spacing, borders, radius, colour
palette, the accent, layout for the existing page, visible focus states, contrast
verification, focus verification in the browser tier, the CSS boundary rules, and the
`website-client` amendment.

**Out, each with the milestone that owns it:**

| Deferred | Why | Owner |
|---|---|---|
| Motion (materialize / disappear) | Slice 1 ships no animation. A `prefers-reduced-motion` block over an unanimated page claims behaviour that has none. | M7 slice 2, **atomically with its opt-out** |
| The five Website sections | `Extension preview` would picture an unbuilt extension — `apps/extension` is an empty placeholder. | M7 slice 3+, with that item gated on M8 |
| Moving components into `packages/ui` | A six-component refactor in a change whose subject is the palette, against 113 tests. | M8, the first second consumer |
| Copying an OTP, filling it in | Not M7's. | M10 |

## Capabilities

### New Capabilities

- `visual-system`: the token layer as a single declaration point, the offline constraint on
  stylesheets, state never carried by colour alone, a visible focus indicator on every
  interactive control, and declared colour pairs meeting WCAG AA in **both** schemes.

### Modified Capabilities

- `website-client`: **one** requirement, *"This milestone builds structure, not visual
  design"*, which this milestone falsifies. Its other 19 requirements are untouched — and
  the clause barring colour-only state conveyance is carried forward unchanged rather than
  restated, because it was already true and this change makes it hard to keep.

### Capabilities deliberately given **no** delta, and why

- `browser-verification`: the new focus spec is collected by the existing "a browser spec
  cannot be silently skipped" rule without a word being changed. That rule exists precisely
  so a new spec is covered *because the suite grew*, not because a spec was amended.
- `build-and-verification`: **no new command.** Contrast runs inside `pnpm test`; focus
  runs inside the existing `pnpm test:browser`. A delta here would be a requirement restating
  what the existing ones already say.
- `monorepo-foundation`: *"The foundation contains no product behaviour"* is scoped to
  milestone M1 and stays true — M1 shipped no product UI. `packages/ui` gaining a token
  layer at M7 does not falsify a statement about M1.
- `spectre-storage`, `mailbox-session`, `provider-*`, `mail-parsing`, `shared-domain-model`:
  untouched. Styling reaches none of them, and the one thing that could have — a client
  reaching a store outside `createBrowserStorage()` — is already a boundary rule.

## Risks

- **A widened scan can produce a false positive on a file type nobody has scanned before.**
  That is the main risk in this change and it is why re-proving the existing rules is a
  task rather than a note.
- **A focus ring can be styled and still be invisible.** A ring in the accent at 2px on a
  1px border can fail against a surface it is too close to. The browser spec is the only
  instrument that settles it, which is why it is in the browser tier and not in a unit test
  that would pass on a declaration nobody rendered.
- **`packages/ui` is consumed as TypeScript source**, so a `.css` export is a new shape for
  this workspace's `exports` map. If Vite does not resolve it from a workspace member, the
  fix is a real build decision and not a guess.

## Out of scope, stated so it is not mistaken for an omission

No animation, no marketing sections, no dark-mode *toggle*, no component library, no icon
package, no Tailwind, no CSS framework, no font binary, no new dependency of any kind.
