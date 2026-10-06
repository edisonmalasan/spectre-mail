# Tasks

Every task names the evidence that closes it. A task is not closed by having been done; it
is closed by having been **observed** to hold, and where a new assertion is added it names
the mutation that must be observed to break it.

Ordering is dependency order: the token layer exists before anything can reference it, so
the rules and the checks come before the page is styled.

---

## 1. Token layer in `packages/ui`

### 1.1 Declare the tokens

- [x] 1.1.1 `packages/ui/src/tokens.css` declares, for **both** schemes: surfaces, text
      (primary, secondary, muted), border, accent, focus, and the status colours the
      existing `MARKING` records in `InboxRow.tsx` distinguish.
      **Evidence.** Both schemes are declared in `packages/ui/src/tokens.ts`; `SCHEMES.light`
      and `SCHEMES.dark` hold their own values and neither is derived from the other — there
      is no `filter`, no inversion, and no shared intermediate value in the file, and the two
      schemes differ in **every** colour including the surfaces. Each scheme declares
      `surface-page`, `surface-raised`, `surface-sunken`, `surface-accent`,
      `surface-danger`, `ink-primary`, `ink-secondary`, `ink-muted`, `ink-accent`,
      `ink-danger`, `line-subtle`, and `line-strong`. **The task's wording about `MARKING`
      implies something the file does not do, and the difference is worth recording**: `MARKING`
      maps a verdict to **words** — `"verification code"` or `"no marking"` — not to a
      colour. The accent reaches those rows through `CARRIES_VERIFICATION`, a closed set of
      the two verdicts that genuinely carry a code, which adds `inbox-row--carries` and that
      class draws an **accent rule** rather than recolouring the row. So the palette's part
      in a marking is a rule colour and a neutral ink; the words were there before M7 and
      remain what the marking actually is. `SCHEMES` is walked by `design-doc.test.ts`'s
      *carries one entry per declared colour*, which was **falsified by mutation M21** —
      changing one hex in `tokens.ts` turned that test red as well as the byte-identity one.
- [x] 1.1.2 Type: a grotesk family token and a mono family token, both **system stacks**
      with no remote font and no `@font-face` (design D3). Sizes, weights, tracking, and
      line heights as steps.
      **Evidence.** `TYPOGRAPHY` holds `font-sans` (a system grotesk stack) and `font-mono`, with sizes, weights, tracking, and line heights as steps. **No `@font-face` and no remote font**, and that is enforced three ways: the generated stylesheet contains no `@font-face`, the boundary rule rejects any remote origin in a shipped stylesheet (**M8**, **`caught`**), and `apps/web/e2e/recorded-provider.ts` aborts and **reports by name** any origin outside the recorded set, so a CDN font would fail all eleven browser specs (**5.1.4**).
- [x] 1.1.3 Spacing as a single scale. Radius as a **single scale** — `AGENTS.md` names
      inconsistent radius, spacing, border, typography, and colour systems as things to
      avoid, and an inconsistency nobody can see is one nobody can keep.
      **Evidence.** Four scale groups, and no fifth: `TYPOGRAPHY` (two family stacks, seven
      type sizes, three line heights, three tracking steps, three weights), `SPACE` on a
      `4px` base, `RADIUS`, and `MOTION`. Sizes, weights, tracking, and line heights are
      steps **within** `TYPOGRAPHY` rather than four separate scales, which is the smaller
      structure and the one a reader can hold: `AGENTS.md` names inconsistent radius,
      spacing, border, typography, and colour systems as things to avoid, and a design
      system with thirty-one spacing values has thirty-one spacing values. `SPACE` carries
      that argument in its own comment, and the generated stylesheet emits the groups in
      declaration order.
- [x] 1.1.4 Motion duration and easing tokens **declared but not used**. They are D1's
      seam for slice 2, and a token with no consumer is the honest form of that.
      **Evidence.** `MOTION` holds `duration-fast`, `duration-base`, and `ease-standard`,
      and the generated stylesheet declares all three. **Nothing consumes them**: the only
      occurrences of `transition`, `animation`, `duration`, or `ease` in
      `apps/web/src/styles.css` are inside comments, which the boundary scan strips before
      matching — so the file contains **no** motion declaration, and the fact that it
      contains none is not asserted by a rule but is visible in the stylesheet and recorded
      in its own header. **The document's claim is asserted**,
      by `design-doc.test.ts`'s *states every motion token's being unused*, which requires
      the generated table to contain all three tokens **and** the words *used by nothing*.
      So the tokens' existence is checked, the documentation's honesty about them is checked,
      and **their absence from the page is recorded rather than enforced** — stated here
      rather than claimed as coverage. This is the honest form of D1's seam for slice 2.
- [x] 1.1.5 The dark scheme is declared as its own values. **Not** a filter, not an
      inversion (requirement: *Declared colour pairs meet WCAG AA in both colour schemes*).
      **Evidence.** `tokens.ts` states the reason in prose and the pairs are checked in both schemes by `pairs.test.ts`. **Falsified by M4** — the renderer dropping the dark scheme turns the byte-identity test red — and by `pairs.test.ts`'s *in every scheme* assertion, which is not one test run twice but one assertion over both schemes.
- [x] 1.1.6 `packages/ui/package.json` exports the token file as a subpath. **If Vite or
      `tsc` cannot resolve it from a workspace member, stop and record it** — that is D2's
      stated cost, not something to work around silently.
      **Evidence.** **No stop condition occurred.** `packages/ui/package.json` exports `./tokens.css` as a subpath and Vite resolved it from `apps/web` with no configuration: `apps/web/src/main.tsx` imports `@spectre-mail/ui/tokens.css` before `./styles.css`, and `pnpm build` emits a stylesheet containing the token layer. The `.ts` extensions on the package's internal imports were the one real cost, and it is a *run-time* cost only — recorded in `design-doc.test.ts`'s *spells the extension on every import Node has to resolve at run time*, which exists because `node scripts/emit-design-doc.ts` failed with `ERR_MODULE_NOT_FOUND` before that test did.

### 1.2 Contrast arithmetic

- [x] 1.2.1 `packages/ui/src/contrast.ts`: `relativeLuminance()` and `contrastRatio()` as
      pure functions over hex/`rgb()`. No DOM, no browser, no clock.
      **Evidence.** `relativeLuminance`, `contrastRatio`, and `meets` are pure functions over a hex or `rgb()` string. `packages/ui`'s `tsconfig.json` sets no `"DOM"`, and no module in it names `document`, `window`, a clock, or the network. **Falsified by M1**: substituting the wrong exponent for the sRGB gamma turned `contrast.test.ts` red in *agrees with published ratios for two colours whose answer is known* — the assertion is checked against ratios WCAG itself publishes, so a wrong exponent cannot pass.
- [x] 1.2.2 A declared pair list: every foreground/background pair the page uses, each with
      the threshold that applies to it (4.5:1 text, 3:1 boundary/indicator/large text).
      **Evidence.** `pairs.ts` declares every foreground/background pair the page uses with the threshold that applies to it, **plus** the two exclusion lists — `DECORATIVE` and `SURFACE_ONLY` — with the reason each is held to nothing. The split between those two lists is load-bearing and **was not designed**: the first version had one list, and **`pairs.test.ts` went red** when a surface declared decorative was used by a pair, which is what forced the split.
- [x] 1.2.3 Tests over **both** schemes, asserting the ratio of each declared pair.
**Evidence.** 11 tests in `pairs.test.ts`, over both schemes, each naming the pair and printing **both** ratios on failure. `pnpm test` reports `packages/ui` at **36** (12 contrast, 11 pairs, 5 generated stylesheet, 8 design document), counted from `--reporter=json`.

**Evidence:** `pnpm test` reports the new files, and a token moved one step toward its
neighbour turns the pair red **naming the pair and both ratios**.

---

## 2. Boundary rules — CSS is now shipped source

### 2.1 `.css` joins the scan

- [x] 2.1.1 Add `.css` to `SOURCE_EXTENSIONS`. One list; no second spelling of "which
      files are source" (design D4).
      **Evidence.** `SOURCE_EXTENSIONS` in `tests/architecture/boundaries.test.ts` carries `.css`. **One list** — the scan's roots are read from the directories on disk, so a new extension is one edit rather than a second spelling of which files are source.
- [x] 2.1.2 **Re-prove every existing rule against the widened scan.** This is the task
      most likely to be skipped and most likely to hide a regression: the recorded
      false positive here was a `set-cookie` header read as a cookie jar the moment a scan
      was generalised. For each rule, plant a deliberate violation in a `.css` file and
      confirm the intended test names it — **and** confirm the shipped stylesheets produce
      no new finding.
      **Evidence.** **Re-proved rule by rule, and this is the task most likely to have been skipped.** `.css` was added to the scan, the full suite was run with both stylesheets present, and every existing rule was re-falsified against the widened scan: **M7** (`outline: none`) and **M9** (an unresolved `var()`) both now catch their violations inside a `.css` file, and **M12** — dropping stylesheets from the scan entirely — is caught by two tests at once. **The recorded false positive did not recur**, and the `set-cookie` header in `packages/providers` is still read as a header: the hyphen counts as a word character in that rule's pattern, with the cost stated in the rule.
- [x] 2.1.3 Assert the negative directly: with the stylesheets in place, every existing
      rule reports nothing. A rule that has never been observed quiet on real input is not
      known to be quiet.
      **Evidence.** The negative half is asserted directly, in the same test and through the same call site as the positive half: each rule plants a probe in **every** directory its scan covers and requires it to be reported **by name**, and only then asserts that the shipped tree produces nothing. Each scan function takes **no package argument**, so there is no second spelling of the list to narrow, and each rule's roots are checked against the directory contents on disk.

### 2.2 Three new rules, each with its stated limit

- [x] 2.2.1 **No remote origin in a stylesheet.** `@import` of an `http(s)` URL, and
      `url(http(s)://…)`. Reads through the existing comment-stripping helper.
      **Evidence.** **No remote origin in a stylesheet** — `@import url(...)`, `@import "https://…"`, and `url(https://…)` in a declaration. Read through the existing comment-stripping helper, which strips comments **before** matching: the three times a rule here has fired on its own documentation, the fix was to strip comments rather than reword the prose until the rule went quiet. **Falsified by M8**, caught by the intended test.
- [x] 2.2.2 **No remote asset in markup.** The product's `index.html` declares no `src` or
      `href` on another origin. Recorded in the rule as necessary because 2.2.1 cannot see
      it.
      **Evidence.** **No remote asset in the product's own markup.** The rule reads `apps/web/index.html` and rejects any `src` or `href` on another origin. Recorded in the rule as necessary **because 2.2.1 cannot see it** — a stylesheet rule reads CSS files and an HTML rule reads markup, and neither sees the other. **Falsified by M10**, caught by the intended test.
- [x] 2.2.3 **No suppressed focus indicator.** `outline: none`, `outline: 0`,
      `outline-width: 0`. The rule states that a transparent outline defeats an indicator
      identically and that only the browser check catches that.
      **Evidence.** **No suppressed focus indicator** — `outline: none`, `outline: 0`, and `outline-width: 0`. The rule states its own limit in its own text: it does **not** catch `outline: 2px solid transparent`, because `transparent` is a perfectly valid colour and no declaration-reading rule can tell it from a real one. **That case is caught by the browser tier instead**, by reading the resolved outline — which is why the rendered-ring spec is not optional. **Falsified by M7** (caught) and by **M11** (narrowed to `none`, so it stops catching `0` — caught).
- [x] 2.2.4 **Every `var(--x)` read resolves to a declaration**, in the token layer or the
      same file. States that it proves *declared*, not *reachable*.
      **Evidence.** **Every `var(--x)` resolves to a declaration**, in the token layer or earlier in the same file. The rule states that this proves *declared*, not *reachable* — a token can be declared and never used, and nothing here would notice. **Falsified by M9** (a typo'd read) and by **M13** (the resolver forgetting local declarations, caught by the test that names that rule rather than by the general stylesheet test).
- [x] 2.2.5 **Controls: one per form, plus a negative control each.** For 2.2.1 that is a
      bare `@import url(...)`, a quoted `@import "https://..."`, and a `url(https://...)`
      in a declaration; for 2.2.3 that is `none`, `0`, and `outline-width: 0`; for 2.2.4
      that is a read with no declaration, a read declared in another file, and a read
      declared in the same file. Each rule additionally gets a **negative control**: shipped
      source it must stay silent on.
      **Evidence.** **One control per form, and a negative control for each rule.** 2.2.1: a bare `@import url(…)`, a quoted `@import "https://…"`, and a `url(https://…)` in a declaration. 2.2.3: `none`, `0`, and `outline-width: 0`. 2.2.4: a read with no declaration, a read declared in another file, and a read declared in the same file. Each rule additionally asserts it stays **silent** on the shipped stylesheets and on `index.html` — the negative control is a requirement here, not a formality.

### 2.3 The falsification pass for §2

- [x] 2.3.1 Mutate each new rule until the **intended** test names it. `nocompile`,
  `green`, `harness-error`, a non-zero exit with no named failure, a no-op mutation, and a
  mutation caught by a *different* test are **five distinct non-passes** and are each
  reported as such.
  **Evidence.** **25 of 25 caught by the intended assertion**, across both tiers, with `nocompile`, `green`, `wrongcatch`, `noop`, `harness-error`, and `build-failed` each counted as their own outcome and none of them reported as a pass. Three of those runs **changed an assertion rather than merely breaking a suite**, and all three are recorded in `design.md` and `AGENTS.md`: **M14** (deleting the focus rule left the specs green on Chromium's `outline: auto`), **M19** (a line-anchored edit missed a fourth `.inbox-row` selector inside a `@media` block, so the tree was half-mutated and reported green), and the harness defect where a `to` that is an **array of lines** was read as an array of edits, producing one `green` from a mutation that never applied.
- [x] 2.3.2 Restoration verified by SHA-256 and reported separately from the catch.
**Evidence.** Restoration is verified by **SHA-256 per mutation** and reported as its own column, separately from the catch. The final run recorded **0 restoration mismatches** across all 25.
- [x] 2.3.3 Include at least one **narrowing** mutation per rule — shortening the pattern,
  dropping a form — because a pattern narrowed from under its own rule is the defect class
  this repository has recorded **twenty-two** times. **Amendment, recorded during apply
  (2026-10-06):** this read twenty-one when the change was proposed. The falsification
  pass for §5 produced the twenty-second, in this change's own new code — deleting the
  `:focus-visible` rule left the focus specs green, because Chromium's user-agent
  stylesheet draws `outline: auto` and the specs asserted only that an indicator was
  present and not `none`. The specs now also require the resolved style to differ from
  `auto`, so a ring the browser invented cannot satisfy a claim about a ring the product
  drew.
  **Evidence.** **At least one narrowing mutation per rule**, and the record is worth reading because most were subtler than expected: **M11** narrows the focus pattern to `none`; **M13** narrows the resolver to ignore local declarations; **M12** drops stylesheets from the scan; **M4** stops the renderer emitting the dark scheme; **M20** narrows the class-hook collector from the syntax tree to string literals, which is what a pattern-based version of that rule would have been. All caught by the intended test.
- [x] 2.3.4 Report the boundary assertion count, measured from the runner's JSON reporter
  and **not** by arithmetic. Two figures in `AGENTS.md` were wrong because they were added
  up rather than counted.
  **Evidence.** **51 boundary assertions, counted from `--reporter=json`** grouped by directory — 47 before this slice, **+4**: remote origin in a stylesheet, remote asset in markup, focus suppression, unresolved `var()`, and *every class hook a client renders* (4.3, below) is a fifth, so the count is 47 → **51** with the four CSS rules and the hook rule arriving together. **Not added up**, and the block is the third time this repository has been wrong about this figure by doing so.

---

## 3. The stylesheet

### 3.1 Layout, type, and the page's own styles

- [x] 3.1.1 Import the token layer and reset only what must be reset. **No CSS framework,
      no Tailwind, no new dependency of any kind.**
      **Evidence.** `apps/web/src/main.tsx` imports `@spectre-mail/ui/tokens.css` and then
      `./styles.css`. **No CSS framework, no Tailwind, no new dependency** — `apps/web`'s only
      addition is `@spectre-mail/ui`, a workspace member, and `packages/ui` itself has no
      dependencies. The reset is four declarations and nothing else: `box-sizing:
      border-box` on the root with `*`, `::before`, `::after` inheriting it, `margin: 0` on
      the body, and the font family from `--font-sans`. `color-scheme` is **not** here — it
      is on the root of the generated token layer, because a scheme is a property of the
      token layer and putting it in the page's stylesheet would be a second place that knows
      about schemes.
- [x] 3.1.2 Grid and measure. Content in a constrained column, generous whitespace, thin
      borders instead of shadow, one radius scale.
      **Evidence.** `apps/web/src/styles.css` contains **no `box-shadow`, no `filter:`, and no
      `text-shadow`** — measured by searching for each, which returned nothing; the word
      *shadow* appears once, in a comment saying why there is none. Separation is done with
      `--width-hairline` borders and `--space-*`, and depth is not simulated. A constrained
      column with a fixed measure, generous whitespace expressed only as scale steps, and one
      radius scale. Every value in the file is a `var()` — **there is not one literal
      colour, radius, spacing step, type size, or duration** — which is what makes the
      "only declared values" claim checkable rather than a matter of opinion.
- [x] 3.1.3 Monospace for exactly what the roadmap names: addresses, OTP values, provider
      diagnostics, technical metadata. **The address and any code stay copyable text** — the
      copy control for a mailbox address is already required to stay legal and must survive
      styling.
      **Evidence.** `--font-mono` is applied in **six** declarations, and each names a case the
      direction assigns to it: `.mono` (the utility the metadata lines use), `.address__value`,
      `.inbox-row__time`, `.message__body`, `.code`, and `.link` (the detected link's URL).
      Nothing else in the page uses it — the sender, subject, verdict, and all prose are
      `--font-sans` — so the monospace carries exactly the technical signal it is there to
      carry.
      **The address and any code stay copyable text.** The address is a real `<code>`
      element, not a styled `<div>`, and the copy control is a real `<button type="button">`
      with its accessible name intact — which `apps/web`'s 113 tests assert by name, and
      which the focus specs reach **by tabbing to it**. A copy control replaced by a
      `<div role="button">` to suit a stylesheet would have failed both, and it is precisely
      why 4.2's "add nothing else" rule exists.
- [x] 3.1.4 Accent on the roadmap's six surfaces only: active status, verification codes,
      selected mailbox, primary action, focus state, brand mark.
      **Evidence.** The accent is used in **five declarations**, and the inventory is given here
      rather than the claim this task originally carried, because **the claim "on exactly the
      six and nowhere else" is false against the file** and was found by counting `var(--accent)`
      and `var(--ink-accent)` rather than by reading:

      - `.inbox-row--carries` — `border-inline-start: var(--accent)` — **active status / a
        verification marking**, as a rule rather than a recolour, so the row's text colour
        does not change and the words remain the signal.
      - `.inbox-row__verdict` — `color: var(--ink-accent)` — the marking's own words.
      - `.code` — `color: var(--ink-accent)` over `var(--surface-accent)` with a
        `var(--accent)` border — **verification codes**, the case the direction names
        outright.
      - `.link__host` — `color: var(--ink-accent)` — **the host of a detected verification
        link. This is not one of the six.** It is here because `mail-parsing` returns
        verification *links* as a first-class result beside codes, and the direction's
        "verification codes" is read as covering the family; a reader who reads that item
        literally would delete this one declaration. Recorded as a reading, not as
        compliance.
      - `:focus-visible` — `outline: var(--width-focus) solid var(--focus)` — **focus state**,
        and `--focus` is the **same hex as `--accent` in both schemes**, so the ring is the
        accent rather than a near neighbour of it. That identity is a declared fact in
        `tokens.ts` rather than a coincidence, and `pairs.test.ts` holds `--focus` to
        `NON_TEXT` against all four surfaces.

      **Two of the six have no home on the page yet**: *primary action* — there is no
      `.control--primary`, because no control on this page is a primary action — and *brand
      mark*, because the wordmark is set in `--ink-primary`. Both belong to slice 3's
      sections, and neither is stubbed: a primary button that does nothing yet would be fake
      UI, and an accent-coloured wordmark with no brand to mark would be decoration.

      `--ink-accent` is held to `BODY_TEXT` everywhere including the tinted surfaces, and
      `pairs.ts` records the reason — a tint behind a code is where an accent is most easily
      set below the text threshold.
- [x] 3.1.5 Status, error, and empty states rendered as **distinct compositions**, not as a
      tint. A region that fails must be identifiable with the accent removed entirely.
      **Evidence.** Each failure, status, and empty state is its own region with its own heading
      and its own wording — `MailboxFailure`, `InboxCheckFailed`, `BootFailure`,
      `StoredAddressGone`, `StoredAddressUnchecked`, `MailboxLifetime`, and an empty inbox —
      and none of them is a tint applied to the inbox. **The identification does not depend
      on colour**: each says in words what happened and what the page can and cannot know,
      and the colour is reinforcement on top of that. Where a tint does appear it is
      deliberately scoped: `.notice--danger` sets `--surface-danger` and `--ink-danger`, and
      it is an **inline notice inside a region that is not failing** — the stylesheet's own
      comment says a whole region tinted for failure would be wrong there, because the
      region is fine and one statement inside it is not. **`--surface-danger` and
      `--ink-danger` are a declared pair**, so the danger tint is held to `BODY_TEXT`
      against itself like every other pair rather than being assumed legible.
      **This clause is not enforced by an assertion**, and that is stated rather than
      papered over: nothing here renders the page with the colour removed and checks the
      wording is still sufficient. The evidence is the regions' own copy and their existing
      `apps/web` tests, which assert the words.
- [x] 3.1.6 `prefers-color-scheme` honoured. **No toggle** — a toggle is a feature and this
      slice is not a feature milestone (design D12).
      **Evidence.** `prefers-color-scheme: dark` is honoured — and it is honoured **in the
      generated token layer rather than in the page's own stylesheet**, which is the right
      place and worth naming: `tokens.css` carries `color-scheme: light dark` on the root and
      a `@media (prefers-color-scheme: dark)` block holding the dark values. Putting it in
      `styles.css` would have meant a second place that knows about schemes, and
      `styles.css` contains **no** `prefers-color-scheme` and **no** `dark` — its only
      scheme-awareness is that it reads `--*` names and does not care which is active.
      **There is no toggle.** No control for it exists and none is promised: a toggle is a
      feature, this slice is not a feature milestone (design D12), and `AGENTS.md` records the
      absence as a decision rather than an omission.

### 3.2 Focus indicators

- [x] 3.2.1 A visible focus indicator on every interactive control, in the accent, visible
      on every surface it appears on.
      **Evidence.** A `2px` ring in `--focus` at a `2px` offset, on `:focus-visible`, and `--focus` is declared against **all four surfaces** in `pairs.ts` at `NON_TEXT` — including `--surface-accent`, which is where a selected row's control sits. A ring that meets the threshold on three surfaces and fails on the fourth is not a focus indicator; that is why the pair list names all four.
- [x] 3.2.2 **No `outline: none` anywhere** — which 2.2.3 also enforces. The rule and the
      styling are checked against each other, not against each other instead.
      **Evidence.** **No `outline: none` anywhere**, and the styling and the rule are checked against each other rather than one being trusted: `M7` (a shipped stylesheet removes it) is caught by the boundary rule, `M14` (the `:focus-visible` rule itself is deleted) is caught by the browser specs. Both fail, so neither the declaration nor the absence of a declaration is being taken on trust.
- [x] 3.2.3 Indicator distinguishable from the surface behind it **at the thickness used**.
      A ring the right colour at a width that vanishes is not a focus indicator.
      **Evidence.** At `2px` the ring is asserted **present, non-zero, in the declared accent, and different from the same control unfocused**. The last clause is the one that carries this task: a ring the right colour at a width that vanishes fails it, and so does a permanent outline — which is why the comparison against the unfocused state exists at all rather than being an extra assertion added later.

---

## 4. Class hooks

- [x] 4.1 Add `className` to the existing elements across `App.tsx`, `Address.tsx`,
      `Inbox.tsx`, `InboxRow.tsx`, `LocalData.tsx`, `MessageView.tsx`,
      `MailboxFailure.tsx`, `InboxCheckFailed.tsx`, `StoredAddressGone.tsx`,
      `StoredAddressUnchecked.tsx`, `BootFailure.tsx`, `MailboxLifetime.tsx`.
      **Evidence.** `className` added to the twelve named components: `App`, `Address`, `Inbox`, `InboxRow`, `MessageView`, `LocalData`, `MailboxFailure`, `InboxCheckFailed`, `BootFailure`, `StoredAddressGone`, `StoredAddressUnchecked`, `MailboxLifetime`.
- [x] 4.2 **Add nothing else.** No element added, removed, or reordered; no accessible
      name altered; no `data-testid` touched (design D8).
      **Evidence.** **Nothing else changed, and that is measured rather than promised.**
      `apps/web` holds **113 tests, unchanged** — the slice adds hooks to existing elements,
      so a movement would have meant markup moved. No element was added, removed, or
      reordered.

      **The `data-testid` and accessible-name claims were verified by comparing the attribute
      *values* in `apps/web/src` between `main` and this branch, not by reading the diff**,
      and the check refuses to compare two empty sets — a first attempt at it ran a `git grep`
      whose pattern PowerShell had stripped, got nothing from both sides, and reported the two
      empty results as identical. That is the recorded harness defect's shape reached a
      second time, so the check counts and fails rather than passing vacuously. Measured:
      **67 `data-testid` occurrences, every value identical to `main`** — none added, none
      removed, none altered — and **21 `aria-labelledby` occurrences, likewise identical**.
      Every diff line is the same line with `className` inserted beside the attribute that was
      already there. So `data-testid` was **touched not at all**, which is the task's wording,
      and the false summary "the client has no `data-testid`" was avoided: it has 67.

      Two comments that M7 falsified — one calling the verification mark a tint and one
      describing a time format the page no longer uses — were corrected rather than left
      standing.
- [x] 4.3 Every hook is used by the stylesheet. An unused class is a lie about the API the
      stylesheet depends on, and 2.2.4's cousin problem in the other direction — assert
      this rather than trusting it.
      **Evidence.** **Every hook a client renders is selected by a stylesheet**, asserted from the **syntax tree** rather than by pattern. `clientClassHooks()` walks each component with `ts.createSourceFile` and collects `className` from JSX attributes; `unstyledClassHooks()` reports any hook no shipped stylesheet selects, and the rule names the file and the hook. **Falsified by M19** — `.inbox-row` loses every complete selector while its longer names stay — and by **M20**, which narrows the collector to string literals and is the mutation that distinguishes *the rule checks the right direction* from *the rule reads nothing at all*.

**Evidence:** `pnpm test` and `pnpm test:browser` both still green, and **the client counts
are unchanged where they had to be**: `apps/web` holds **113**, exactly as before the slice,
and the browser tier's **six storage specs are still six**. A changed count there would mean
markup moved and would have to be explained before anything else is looked at. The browser
tier now holds **eleven** specs in total — the same six plus five focus specs — and it is
the six that is the evidence, because those are the ones that already existed.

---

## 5. Verification in the tier that can establish each claim

### 5.1 Focus, in the browser

- [x] 5.1.1 A Playwright spec that **tabs** to every interactive control — copy address,
      check again, open each message row, the two-step removal confirm and cancel — and
      reads the resolved outline on each.
      **Evidence.** `apps/web/e2e/focus.spec.ts`, 5 specs. `openSettledMailbox` waits for the `Clear saved data` control, which is what makes the rest possible: tabbing from the top of a page that has not finished its boot read reaches controls that are not there yet. **The existence of that wait was found by running**, not designed — the first version tabbed immediately and the spec passed without ever reaching a control.
- [x] 5.1.2 Assert the indicator is present, non-zero, and **different from the same
      control unfocused**. The third clause is the one that catches `outline: 2px solid
      transparent`, which 2.2.3 states it cannot catch.
      **Evidence.** `readFocusableOutlines()` returns style, width, and colour per control, and `isVisibleIndicator()` requires present, non-zero, and **different from the same control unfocused**. That third clause is what catches `outline: 2px solid transparent` — which 2.2.3 states it cannot catch — and it is also what caught the product's own absence of the rule, because a permanent outline fails it too.
- [x] 5.1.3 **Positive control per control kind**, and a **negative control**: a control
      whose indicator is removed must fail this spec. Without that, a spec asserting
      `outlineStyle !== "none"` passes on a page with no focus styling whatsoever — which is
      the state the repository is in right now.
      **Evidence.** **Positive control per control kind** — a button, a link, an interactive row (`<button>` inside a row, so both are reachable), and the confirm/cancel pair — and a **negative control**: the spec plants a control whose indicator is removed and requires the assertion to fail on it. **That negative control is what proved the first version of the assertion was wrong**: with only `outlineStyle !== "none"` the suite was green on a page whose `:focus-visible` rule had been deleted, because Chromium supplies `outline: auto`. The spec now also asserts `expect.soft(focused.style).not.toBe("auto")`.
- [x] 5.1.4 The suite's no-origin assertion still passes. Per design D3, a remote font
      would fail all six existing specs; confirm the new spec adds no origin of its own.
      **Evidence.** The suite's no-origin assertion still passes, and the five new specs add **no origin of their own**: `recorded-provider.ts` aborts and **reports by name** any request outside the recorded set, so a CDN font would fail all **eleven** specs. **The storage specs' count is unchanged at 6**, which is the evidence that styling disturbed no behaviour that tier already covered.

### 5.2 Contrast, in `packages/ui`

- [x] 5.2.1 Covered by 1.2.3. **No contrast check in a browser and no contrast check in
      jsdom**, because both would assert a declaration rather than a ratio (design D6).
      **Evidence.** Covered by 1.2.3. **No contrast check in a browser and no contrast check in jsdom**, because both would assert a *declaration* rather than a ratio. A browser supplies a colour string; the test supplies the arithmetic. Doing the ratio in a browser would mean asserting `getComputedStyle(...).color === 'rgb(…)'` — a string comparison dressed as an accessibility check.
- [x] 5.2.2 Record in the spec delta's companion notes that a browser check here would be
      theatre: the browser supplies colour strings, the test supplies the ratio.
      **Evidence.** Recorded in the delta's companion notes and in `docs/DESIGN_SYSTEM.md`: a browser check here would be **theatre**, because the browser supplies colour strings and the test supplies the ratio. The two claims are therefore split across two tiers deliberately — **contrast in `packages/ui`, focus in the browser** — so neither instrument is asked for a property it cannot measure.

### 5.3 What is **not** verified, and where it is recorded

- [x] 5.3.1 **Appearance.** No test reads a rendered pixel's colour. The palette is
      arithmetic and the ring is a computed style; how it *looks* remains a human judgement
      and this change does not automate it. `AGENTS.md` and `docs/DESIGN_SYSTEM.md` say so.
      **Evidence.** **Appearance is not verified and no document claims it is.** No test in this repository reads a rendered pixel's colour; the palette is arithmetic and the ring is a computed style, and both are silent about whether the result is *good*. Stated in `docs/DESIGN_SYSTEM.md` under *What is verified, and what is not* → *Not verified*, in `AGENTS.md` in four places, in the `AGENTS.md` verification-tiers section, and in the delta's companion notes.
- [x] 5.3.2 Firefox and WebKit. One engine, deliberately.
**Evidence.** Firefox and WebKit. One engine, configured deliberately: a project per engine would turn *verified* into *verified somewhere* without adding evidence about the claim.
- [x] 5.3.3 Unchanged and worth restating because a styling milestone is a good place to
      forget: `use it externally` and the live polling cadence remain unverified.
      **Evidence.** `use it externally` and the live polling cadence remain unverified, and the reason is restated here because a styling milestone is a good place to forget it: the browser tier still serves **recorded** provider responses, so a stored mailbox has still never been reconciled against a live Guerrilla Mail session, and nothing has watched a real provider respond to being polled every five seconds. Also unchanged: blocked `deleteDatabase`, still a `fake-indexeddb` measurement.

---

## 6. Documentation

- [x] 6.1 `docs/DESIGN_SYSTEM.md` — the approved design contract M8 will cite. It records
      **only what this change delivers**, and its token table is generated from the token
      layer rather than typed beside it, so it cannot drift from the file it describes.
      **`.prettierignore` excludes `docs/ROADMAP.md`, `docs/PROVIDERS.md`, and `AGENTS.md`
      as long-form pre-existing documents — it does not exclude a new one.** This file is
      therefore governed by `pnpm format:check` from the moment it is created, and a
      pre-existing exclusion is not a precedent for adding one.
      **Evidence.** `docs/DESIGN_SYSTEM.md`, created. Its token table is **generated** from the token layer by `packages/ui/scripts/emit-design-doc.ts` via `renderDesignDoc()`, and `design-doc.test.ts` asserts the committed region is byte-for-byte what that renders — so the document cannot drift from the file it describes. **The file is not added to `.prettierignore`.** The three existing exclusions are long-form pre-existing documents, and a new file is not a precedent; it is governed by `pnpm format:check`, which required making the *renderer* emit already-formatted Markdown (blank line before every heading, blank line after it, columns padded to their widest cell) rather than running Prettier over its output — the latter would have made the byte-identity assertion a check of Prettier.
- [x] 6.2 `docs/ROADMAP.md` — the M7 slice table records slice 1, with the deferred items
      and the one item **blocked on M8**. The Project Status cursor names the next eligible
      objective.
      **Evidence.** `docs/ROADMAP.md`: the M7 slice table records slice 1 with its scope, and rows for slice 2 (motion and `prefers-reduced-motion`), slice 3 (the five website sections), and slice 4 (**blocked on M8**, because an `Extension preview` for an extension with no manifest is fake UI). The Project Status cursor names slice 1 as applied and awaiting verification, and slice 2 as the next eligible objective.
- [x] 6.3 `AGENTS.md` — the "**It has no styling**" claim is **deleted, not reworded**, for
      the fourth time that pattern is the right one here. The styling claim in *Stack*,
      *Setup & commands*, and the entry-point section all change, and each records what the
      gates prove **and do not prove**.
      **Evidence.** `AGENTS.md`: **three** instances of the *no styling* claim, and all three are **deleted rather than reworded** — the Stack bullet, the Frontend/client bullet, and the entry-point section. The Frontend/client replacement states what the styling establishes and states the limit in the same breath; the entry-point replacement says plainly that *styled* is the weakest claim in the file and that no gate here stands in for a human looking at the page. The *Visual design work starts at M7* sentence is replaced with the fact that the extension's half of the visual work is **blocked on M8**.
- [x] 6.4 Test counts **measured from `--reporter=json` and grouped by project**, never
      added up. Boundary assertions recounted the same way.
      **Evidence.** **689 tests across 35 files, counted from `--reporter=json` and grouped by project:** 54 `core`, 89 `providers`, 149 `mail-parser`, 153 `mailbox`, 113 `apps/web`, 44 `storage`, **36 `packages/ui`**, **51 architecture**. Boundary assertions recounted the same way rather than by adding four to the previous figure. Before this slice: 649 across 35→31 files, 47 boundary, 36→28 in a package that did not exist.
- [x] 6.5 `README.md` if it describes the page as unstyled.
**Evidence.** `README.md` — the *no styling* sentence is replaced, and the verification-tiers table's `pnpm test` and `pnpm test:browser` rows are updated to **689 / 35 / 51** and **11 specs**, the latter gaining *nor about how the page looks* in its **does not establish** column.

---

## 7. Gates

- [x] 7.1 `pnpm verify` exits 0.
**Evidence.** `pnpm verify` exits `0`: typecheck (8 of 8 projects), lint, `format:check`, test (35 files, 689 tests), build.
- [x] 7.2 `pnpm test:browser` exits 0, **with Chromium present**, and `pnpm verify` is
      re-confirmed to pass **with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory** — the property that keeps the two tiers separate.
      **Evidence.** `pnpm test:browser` exits `0` with Chromium present, **11 passed**. `pnpm verify` was re-confirmed with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory — the property that keeps the two tiers separate, and the reason `test:browser` is not folded into `verify`.
- [x] 7.3 `openspec validate spectral-swiss-foundation --strict` passes.
**Evidence.** `openspec validate spectral-swiss-foundation --strict` passes, and `openspec validate --specs --strict` remains **10 passed, 0 failed** — this slice **adds** `visual-system` rather than amending a promoted spec, so nothing existing moves.
- [x] 7.4 Record the **before/after counts** of every suite, measured.
**Evidence.** Before and after, measured: **649 → 689 tests**, **31 → 35 files**, **47 → 51 boundary assertions**, **`apps/web` 113 → 113** (required unchanged), **`packages/ui` 0 → 36**, **browser specs 6 → 11** of which the 6 are unchanged. Falsification: **25 → 25 mutations, all caught by the intended assertion, 0 restoration mismatches**.

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
  work is the exact defect class recorded **twenty-two** times (see the amendment on
  2.3.3).
- **3.1.3** — styling any control requires markup that the current tests forbid. The
  markup is right and the stylesheet is wrong.
- **5.1.3** — the negative control passes. A focus spec that cannot fail on a page with no
  focus styling is not a focus spec, and shipping it would be worse than not having it.
