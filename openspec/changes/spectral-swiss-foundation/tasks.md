# Tasks

Every task names the evidence that closes it. A task is not closed by having been done; it
is closed by having been **observed** to hold, and where a new assertion is added it names
the mutation that must be observed to break it.

Ordering is dependency order: the token layer exists before anything can reference it, so
the rules and the checks come before the page is styled.

---

## 1. Token layer in `packages/ui`

### 1.1 Declare the tokens

- [ ] 1.1.1 `packages/ui/src/tokens.css` declares, for **both** schemes: surfaces, text
      (primary, secondary, muted), border, accent, focus, and the status colours the
      existing `MARKING` records in `InboxRow.tsx` distinguish.
- [ ] 1.1.2 Type: a grotesk family token and a mono family token, both **system stacks**
      with no remote font and no `@font-face` (design D3). Sizes, weights, tracking, and
      line heights as steps.
- [ ] 1.1.3 Spacing as a single scale. Radius as a **single scale** — `AGENTS.md` names
      inconsistent radius, spacing, border, typography, and colour systems as things to
      avoid, and an inconsistency nobody can see is one nobody can keep.
- [ ] 1.1.4 Motion duration and easing tokens **declared but not used**. They are D1's
      seam for slice 2, and a token with no consumer is the honest form of that.
- [ ] 1.1.5 The dark scheme is declared as its own values. **Not** a filter, not an
      inversion (requirement: *Declared colour pairs meet WCAG AA in both colour schemes*).
- [ ] 1.1.6 `packages/ui/package.json` exports the token file as a subpath. **If Vite or
      `tsc` cannot resolve it from a workspace member, stop and record it** — that is D2's
      stated cost, not something to work around silently.

### 1.2 Contrast arithmetic

- [ ] 1.2.1 `packages/ui/src/contrast.ts`: `relativeLuminance()` and `contrastRatio()` as
      pure functions over hex/`rgb()`. No DOM, no browser, no clock.
- [ ] 1.2.2 A declared pair list: every foreground/background pair the page uses, each with
      the threshold that applies to it (4.5:1 text, 3:1 boundary/indicator/large text).
- [ ] 1.2.3 Tests over **both** schemes, asserting the ratio of each declared pair.

**Evidence:** `pnpm test` reports the new files, and a token moved one step toward its
neighbour turns the pair red **naming the pair and both ratios**.

---

## 2. Boundary rules — CSS is now shipped source

### 2.1 `.css` joins the scan

- [ ] 2.1.1 Add `.css` to `SOURCE_EXTENSIONS`. One list; no second spelling of "which
      files are source" (design D4).
- [ ] 2.1.2 **Re-prove every existing rule against the widened scan.** This is the task
      most likely to be skipped and most likely to hide a regression: the recorded
      false positive here was a `set-cookie` header read as a cookie jar the moment a scan
      was generalised. For each rule, plant a deliberate violation in a `.css` file and
      confirm the intended test names it — **and** confirm the shipped stylesheets produce
      no new finding.
- [ ] 2.1.3 Assert the negative directly: with the stylesheets in place, every existing
      rule reports nothing. A rule that has never been observed quiet on real input is not
      known to be quiet.

### 2.2 Three new rules, each with its stated limit

- [ ] 2.2.1 **No remote origin in a stylesheet.** `@import` of an `http(s)` URL, and
      `url(http(s)://…)`. Reads through the existing comment-stripping helper.
- [ ] 2.2.2 **No remote asset in markup.** The product's `index.html` declares no `src` or
      `href` on another origin. Recorded in the rule as necessary because 2.2.1 cannot see
      it.
- [ ] 2.2.3 **No suppressed focus indicator.** `outline: none`, `outline: 0`,
      `outline-width: 0`. The rule states that a transparent outline defeats an indicator
      identically and that only the browser check catches that.
- [ ] 2.2.4 **Every `var(--x)` read resolves to a declaration**, in the token layer or the
      same file. States that it proves *declared*, not *reachable*.
- [ ] 2.2.5 **Controls: one per form, plus a negative control each.** For 2.2.1 that is a
      bare `@import url(...)`, a quoted `@import "https://..."`, and a `url(https://...)`
      in a declaration; for 2.2.3 that is `none`, `0`, and `outline-width: 0`; for 2.2.4
      that is a read with no declaration, a read declared in another file, and a read
      declared in the same file. Each rule additionally gets a **negative control**: shipped
      source it must stay silent on.

### 2.3 The falsification pass for §2

- [ ] 2.3.1 Mutate each new rule until the **intended** test names it. `nocompile`,
  `green`, `harness-error`, a non-zero exit with no named failure, a no-op mutation, and a
  mutation caught by a *different* test are **five distinct non-passes** and are each
  reported as such.
- [ ] 2.3.2 Restoration verified by SHA-256 and reported separately from the catch.
- [ ] 2.3.3 Include at least one **narrowing** mutation per rule — shortening the pattern,
  dropping a form — because a pattern narrowed from under its own rule is the defect class
  this repository has recorded twenty-one times.
- [ ] 2.3.4 Report the boundary assertion count, measured from the runner's JSON reporter
  and **not** by arithmetic. Two figures in `AGENTS.md` were wrong because they were added
  up rather than counted.

---

## 3. The stylesheet

### 3.1 Layout, type, and the page's own styles

- [ ] 3.1.1 Import the token layer and reset only what must be reset. **No CSS framework,
      no Tailwind, no new dependency of any kind.**
- [ ] 3.1.2 Grid and measure. Content in a constrained column, generous whitespace, thin
      borders instead of shadow, one radius scale.
- [ ] 3.1.3 Monospace for exactly what the roadmap names: addresses, OTP values, provider
      diagnostics, technical metadata. **The address and any code stay copyable text** — the
      copy control for a mailbox address is already required to stay legal and must survive
      styling.
- [ ] 3.1.4 Accent on the roadmap's six surfaces only: active status, verification codes,
      selected mailbox, primary action, focus state, brand mark.
- [ ] 3.1.5 Status, error, and empty states rendered as **distinct compositions**, not as a
      tint. A region that fails must be identifiable with the accent removed entirely.
- [ ] 3.1.6 `prefers-color-scheme` honoured. **No toggle** — a toggle is a feature and this
      slice is not a feature milestone (design D12).

### 3.2 Focus indicators

- [ ] 3.2.1 A visible focus indicator on every interactive control, in the accent, visible
      on every surface it appears on.
- [ ] 3.2.2 **No `outline: none` anywhere** — which 2.2.3 also enforces. The rule and the
      styling are checked against each other, not against each other instead.
- [ ] 3.2.3 Indicator distinguishable from the surface behind it **at the thickness used**.
      A ring the right colour at a width that vanishes is not a focus indicator.

---

## 4. Class hooks

- [ ] 4.1 Add `className` to the existing elements across `App.tsx`, `Address.tsx`,
      `Inbox.tsx`, `InboxRow.tsx`, `LocalData.tsx`, `MessageView.tsx`,
      `MailboxFailure.tsx`, `InboxCheckFailed.tsx`, `StoredAddressGone.tsx`,
      `StoredAddressUnchecked.tsx`, `BootFailure.tsx`, `MailboxLifetime.tsx`.
- [ ] 4.2 **Add nothing else.** No element added, removed, or reordered; no accessible
      name altered; no `data-testid` touched (design D8).
- [ ] 4.3 Every hook is used by the stylesheet. An unused class is a lie about the API the
      stylesheet depends on, and 2.2.4's cousin problem in the other direction — assert
      this rather than trusting it.

**Evidence:** `pnpm test` and `pnpm test:browser` both still green with the **same counts**,
113 and 6. A changed count means markup moved and must be explained before anything else
is looked at.

---

## 5. Verification in the tier that can establish each claim

### 5.1 Focus, in the browser

- [ ] 5.1.1 A Playwright spec that **tabs** to every interactive control — copy address,
      check again, open each message row, the two-step removal confirm and cancel — and
      reads the resolved outline on each.
- [ ] 5.1.2 Assert the indicator is present, non-zero, and **different from the same
      control unfocused**. The third clause is the one that catches `outline: 2px solid
      transparent`, which 2.2.3 states it cannot catch.
- [ ] 5.1.3 **Positive control per control kind**, and a **negative control**: a control
      whose indicator is removed must fail this spec. Without that, a spec asserting
      `outlineStyle !== "none"` passes on a page with no focus styling whatsoever — which is
      the state the repository is in right now.
- [ ] 5.1.4 The suite's no-origin assertion still passes. Per design D3, a remote font
      would fail all six existing specs; confirm the new spec adds no origin of its own.

### 5.2 Contrast, in `packages/ui`

- [ ] 5.2.1 Covered by 1.2.3. **No contrast check in a browser and no contrast check in
      jsdom**, because both would assert a declaration rather than a ratio (design D6).
- [ ] 5.2.2 Record in the spec delta's companion notes that a browser check here would be
      theatre: the browser supplies colour strings, the test supplies the ratio.

### 5.3 What is **not** verified, and where it is recorded

- [ ] 5.3.1 **Appearance.** No test reads a rendered pixel's colour. The palette is
      arithmetic and the ring is a computed style; how it *looks* remains a human judgement
      and this change does not automate it. `AGENTS.md` and `docs/DESIGN_SYSTEM.md` say so.
- [ ] 5.3.2 Firefox and WebKit. One engine, deliberately.
- [ ] 5.3.3 Unchanged and worth restating because a styling milestone is a good place to
      forget: `use it externally` and the live polling cadence remain unverified.

---

## 6. Documentation

- [ ] 6.1 `docs/DESIGN_SYSTEM.md` — the approved design contract M8 will cite. It records
      **only what this change delivers**, and its token table is generated from the token
      layer rather than typed beside it, so it cannot drift from the file it describes.
      **`.prettierignore` excludes `docs/ROADMAP.md`, `docs/PROVIDERS.md`, and `AGENTS.md`
      as long-form pre-existing documents — it does not exclude a new one.** This file is
      therefore governed by `pnpm format:check` from the moment it is created, and a
      pre-existing exclusion is not a precedent for adding one.
- [ ] 6.2 `docs/ROADMAP.md` — the M7 slice table records slice 1, with the deferred items
      and the one item **blocked on M8**. The Project Status cursor names the next eligible
      objective.
- [ ] 6.3 `AGENTS.md` — the "**It has no styling**" claim is **deleted, not reworded**, for
      the fourth time that pattern is the right one here. The styling claim in *Stack*,
      *Setup & commands*, and the entry-point section all change, and each records what the
      gates prove **and do not prove**.
- [ ] 6.4 Test counts **measured from `--reporter=json` and grouped by project**, never
      added up. Boundary assertions recounted the same way.
- [ ] 6.5 `README.md` if it describes the page as unstyled.

---

## 7. Gates

- [ ] 7.1 `pnpm verify` exits 0.
- [ ] 7.2 `pnpm test:browser` exits 0, **with Chromium present**, and `pnpm verify` is
      re-confirmed to pass **with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory** — the property that keeps the two tiers separate.
- [ ] 7.3 `openspec validate spectral-swiss-foundation --strict` passes.
- [ ] 7.4 Record the **before/after counts** of every suite, measured.

---

## 8. Verification pass (separate, after apply)

- [ ] 8.1 Compare the implementation against `proposal.md`, `design.md`, and these tasks.
      **Not against the ticked boxes** — a ticked box is a claim about the work, not
      evidence for it.
- [ ] 8.2 Re-check **every limit in design D12** against the finished change. A limit true
      at proposal and false after implementation is a limit nobody recorded.
- [ ] 8.3 Confirm each deferred item is recorded **with an owner**, not quietly dropped.
- [ ] 8.4 Any CRITICAL blocks completion. Any WARNING blocks unless explicitly accepted.

---

## Stop conditions

Stop and record, rather than decide alone, if any of these occurs:

- **1.1.6** — the token subpath cannot be resolved from a workspace member. That is an
  architectural decision about how a shared package ships CSS, not a workaround.
- **2.1.2** — widening the scan to `.css` produces a false positive in an existing rule
  that cannot be resolved without narrowing that rule. Narrowing a rule to make a new one
  work is the exact defect class recorded twenty-one times.
- **3.1.3** — styling any control requires markup that the current tests forbid. The
  markup is right and the stylesheet is wrong.
- **5.1.3** — the negative control passes. A focus spec that cannot fail on a page with no
  focus styling is not a focus spec, and shipping it would be worse than not having it.
