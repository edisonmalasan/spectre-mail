# Tasks

Seven groups. **Each group lands the tests and the documentation its own work calls for**, so a
group whose work needs neither carries neither. The final group is integration checks, hand-offs and
the things this change deliberately does not do.

**Six properties are held from the first group to the last and are restated here so no group can be
read in isolation without them.** Any movement in the first four is a finding to explain before
anything else is looked at; the last two are defects.

| held at | what | why |
| --- | --- | --- |
| **125** | `apps/web` tests | the website already renders this union (`apps/web/src/InboxRow.tsx`) and **this change touches it not at all** — it ports the website's scheme, it does not write one |
| **38** | `packages/ui` tests | **adding a token is a failure of this change.** The marking is **words only with no accent rule** (`design.md` D5), so it needs no token, no class hook and no stylesheet rule; it inherits the generic `.panel p` at `styles.css:151` |
| **86** | `packages/storage` tests | the verdict is **in memory only** (`design.md` D8) |
| **166** | `packages/mailbox` tests | **the strongest held property here**: the session already produces, holds and reports the verdict (`design.md` D3) and this change only surfaces it |
| **53** | architecture boundary assertions | **no rule is added** — every property here already has an instrument, named in 7.3 |
| **byte-identical** | `apps/extension/static/manifest.json` | zero new permissions. SHA-256 `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`, re-measured at proposal |

**`mailbox-session` and `spectre-storage` carry no delta in this change**, and that is a decision
(`design.md` D8) rather than an omission.

---

## 1. The marking on the listing row, opt-in and off by default

- [x] 1.1 Give `MessageList` in `apps/extension/src/MessageSurface.tsx` **one optional prop,
      `verdictWording`**, carrying a `Readonly<Record<MessageVerdict["kind"], string>>` the caller
      owns — **the `links` precedent exactly** (`MessageSurface.tsx:233`, a record of labels whose
      absence is what keeps the popup free of them), and `clipboard`/`links`/`onCopyLink` at
      `:210`–`:215` is the rule it follows. **The default is absent**, so the popup's listing renders
      exactly what it renders today (`design.md` D11).
      **Verify:** a `MessageList` rendered **without** the prop carries no marking under **any**
      verdict; `Popup.tsx:314` is unchanged; and `Popup.tsx` gains no prop — so `Popup.test.tsx`
      stays **25** with no case edited. **The prop does not carry the verdicts map**, and a mutation
      passing one instead is caught by the case in 4.1a.

- [x] 1.2 Render the marking from the listing the prop's caller **already had**, reading each row's
      verdict through **`verdictFor(state.listing.verdicts, message.id)`**
      (`packages/mailbox/src/state.ts:455`, which defaults to `undetermined`) rather than a second
      lookup written here. **Port the website's exhaustive record** — every kind listed including the
      empty one, exactly as `apps/web/src/InboxRow.tsx:79`–`:85` does (`design.md` D14). **An
      exhaustive record means a sixth verdict would fail to compile**, which is the point.
      **`CARRIES_VERIFICATION` is deliberately NOT ported** (`design.md` D14): its only consumer is
      the accent rule, and 1.3 adds none — so a case is written against its *absence* as a decision
      rather than an oversight.
      **Verify:** the four deterministic arms each have a case; a `carriesCode` row and a
      `carriesLink` row are distinguishable **by their own text**; and **a closed positive set is
      absent from the diff**, with a comment saying why, so its absence is not read as an oversight.

- [x] 1.3 A message the session has **not** determined carries a marking **on its own row**, naming
      that it could not be read, and **no accent or other visual claim of a detection** (`design.md`
      D5 — the website's answer, and this change's first draft chose a count instead and reversed).
      **Verify:** an `undetermined` row carries wording; that wording **asserts nothing about what the
      message carries**; a `carriesNothing` row carries **nothing at all**; and a listing whose
      verdicts are **not all determined** does **not** state that the mailbox holds no detected
      verification. **No count of undetermined messages ships** (A8).

- [x] 1.4 Render the marking as a **`<p>` carrying a `data-testid` and no class at all**, so
      `styles.css` gains no rule and `packages/ui` gains no token. `styles.css:150`–`:151` already
      declares `.popup p, .panel p`, and `Panel.tsx` already carries `className="panel"` (`:510`,
      `:523`, `:588`, `:589`). **Adding a token, a class hook or a rule is a failure of this change**
      and the reason is recorded in `design.md` D5.
      **Verify:** `git diff` over `apps/extension/src/styles.css` is **empty**; the marking node
      carries no `className` at all; and the boundary rule that every rendered class hook is styled
      still passes **unedited** — it reads `className`, so an unstyled `data-testid` cannot fail it.

- [x] 1.5 Pass the prop from `Panel.tsx:754` and **change nothing else in that file**.
      **Verify:** `git diff` over `Panel.tsx` is the prop and its value, **plus comment** — the
      point of `design.md` D3 is that the panel renders a field the session already populated.

- [x] 1.6 Prove the marking costs no provider request and reads no body (`design.md` D4). Assert the
      count across the whole listing, **not per row**.
      **Verify:** with the marking implemented, the provider request log for a panel opened on a
      one-message mailbox is **the same count as before the marking existed**; and no case in the
      unit tier passes a body to `MessageList`.

---

## 2. The panel's own words, in `panel-copy.ts`

- [x] 2.1 Add **`PANEL_VERDICT_WORDING`** to `panel-copy.ts` — the exhaustive record over the whole
      union, **every kind listed including `carriesNothing`'s empty one**, following the module's own
      rule that a claim is reviewable beside the requirement it satisfies. **Each entry's comment
      names the delta scenario it discharges**, and the record's own docstring names why these words
      are the panel's and not the message surface's (`design.md` D11 — the same reason
      `CodeClipboardActions` is caller-supplied rather than a string in `POPUP_COPY`).
      **Verify:** every entry's comment names the scenario it discharges; the record is exhaustive, so
      **a sixth verdict fails to compile**; and the existing `panel-copy.test.ts` sweep finds no
      entry that is not reachable from a rendered panel.

- [x] 2.2 **Add no chooser key.** `PANEL_CHOOSER_KEYS` is untouched — the marking is not a control,
      and `design.md` D11's opt-in is a rendering decision, not a choice.
      **Verify:** `PANEL_CHOOSER_KEYS` is **byte-identical**; a sweep over the chooser's keys still
      passes; and no new key appears beside it in either direction.

- [x] 2.3 **No string claims a message carries no verification, and none states a confidence
      (`design.md` D6).** The wording reports what the session determined.
      **Verify:** a sweep over every `PANEL_COPY` entry — and over the **rendered** panel text —
      matches **no** forbidden phrasing (`%`, *"certainty"*, *"no verification"*, *"nothing to
      verify"*). **A sweep matching nothing satisfies every assertion above it for ever, so the
      sweep carries a negative control**: plant a forbidden phrase and require the sweep to report
      it.

- [x] 2.4 **No string uses the word *pending*** (`design.md` D1).
      **Verify:** the same sweep's forbidden list includes it, **with its own control**, so a sweep
      with a pattern that cannot fire is reported by the control rather than passing quietly.

---

## 3. Held properties, each made falsifiable rather than asserted in a note

- [x] 3.1 **`packages/storage` untouched** (`design.md` D8). **Verify:** `git diff --stat` over
      `packages/storage` is **empty**; the package is **86** tests before and after; and a sweep
      over `apps/extension/src` finds **no** new call to `saveMailbox`, `addMailbox`, or any
      storage entry point outside `storage.ts`.

- [x] 3.2 **No new permission.** **Verify:** `apps/extension/static/manifest.json` is
      **byte-identical**, SHA-256 `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`,
      and the browser tier's existing manifest case still passes **unedited**.

- [x] 3.3 **No new boundary rule — name the instruments instead.** **The count is held at 53**, and
      that is a decision with a reason, not an omission:

  | property | the instrument that already holds it |
  | --- | --- |
  | the panel reads a verdict, and does not read a body | the request-count assertion in 1.6 / 4.3 |
  | the popup is not given a marking | `Popup.test.tsx`, unchanged at **25**, plus 1.1's absent-prop case and 4.2 |
  | the marking renders no class hook, so no stylesheet rule is owed | the existing "every rendered class hook is styled" rule, **unedited**, plus 1.4 |
  | a client does not restate a shared package's value | the existing rule requiring a client's own value to come from the shared package |
  | no client reaches a store directly | the existing client-storage rule |
  | `manifest.json` gains nothing | the existing manifest browser case |

  **Verify:** `tests/architecture/boundaries.test.ts` is **53** assertions before and after; the
  file's `git diff` is **empty**; and **every row above names a case that exists**, with the count
  read off the run's own reporter rather than from this file.

- [x] 3.4 **No delta for `mailbox-session` or `spectre-storage`.** **Verify:** `openspec validate
      --specs --strict` reports **14 passed, 0 failed** after the delta is written, and
      `git diff --stat` over `packages/storage` is **empty**.

      **Amendment, recorded during apply (2026-10-13).** **The Verify clause as proposed was false
      on arrival, and this is recorded rather than quietly satisfied.** It read that
      `git diff --stat` over `packages/mailbox` **and** `packages/storage` is **empty** — but
      **task 5.2 edits `packages/mailbox/src/inbox.ts` in this very change**, so the clause could
      never be satisfied by a correct implementation of the change it describes. **Two halves of
      one task file cannot be allowed to disagree**, and the honest repair is to the clause rather
      than to 5.2: 5.2's edit is required, deliberate and comment-only, and deleting it to satisfy
      3.4 would leave the false claim in `inbox.ts:105`–`:106` standing.

      **Corrected Verify:** `git diff --stat` over `packages/storage` is **empty**, and over
      `packages/mailbox` it is **comment lines only** with an **empty behavioural diff** — which is
      **5.2's own clause, already stated there**, so 3.4 now defers to it instead of restating a
      weaker and contradictory version. Measured at apply: the behavioural diff over
      `packages/mailbox` with comment lines stripped is **empty**, and the package holds **166**
      tests before and after — **a comment is not a test**, which is the whole reason the package
      count is the property that proves 5.2 was comment-only.

---

## 4. The browser tier: what the panel shows, on the built page

**The case count is derived from the delta's scenarios and clauses, not guessed.**
`side-panel.spec.ts` is **13** today. The delta carries **7 scenarios**; **six** become one case each
and **one clause outside the scenarios — the shared-component default — becomes the popup-absent case
(4.2).** **13 + 7 = 20.** The one scenario that is *not* a new case is named below with the reason,
and **"17+" is not a task and neither is a number nobody derived.**

| delta scenario or clause | new case | notes |
| --- | --- | --- |
| A message carries a detected verification | **4.1a** | one case covering `carriesCode` and `carriesLink`, asserting the two are distinguishable **by their own text** |
| A message was read and carries nothing | **4.1b** | asserts the row is bare **and** that no "no verification" phrasing appears |
| A message could not be determined | **4.1c** | wording on that row; nothing asserted about what it carries |
| The listing is not yet determined in full | **4.1d** | no "holds no detected verification" |
| **A check failed and the last known listing is shown** | **4.1e** | **the reverse false claim**: a row from a `checkFailed` listing **was** read, so marking it *"could not be read"* would be false — and a refactor that dropped the marking on that variant would lose it silently (`design.md` D3) |
| the clause: a surface that does not ask renders its listing exactly as it does without this requirement | **4.2** | the popup-absent arm |
| The panel states what the session holds | **4.3** | the request-count readback — **not** a rendering case |
| Nothing is stored | **none** | a browser tier has no way to observe an absence **across a restart**; this is held by **3.1** at the storage boundary instead |

- [x] 4.1 `side-panel.spec.ts` **13 → 20**, adding exactly **4.1a, 4.1b, 4.1c, 4.1d, 4.1e** and
      **4.2**.
      **Verify:** each case names the verdict it stages; **4.1e stages a failed check** and asserts
      the retained rows still carry the verdicts they were given; and **each staged arm has a
      negative control** — a case requiring the reader to report a planted marking as one it did not
      find, because a sweep matching nothing satisfies every assertion above it for ever.

- [x] 4.2 **The popup's listing carries no marking, in the built extension, in the same tier, and
      this is the case `design.md` D11 exists to make possible.** The panel and the popup render the
      **same component**, so this is the only place a leak between them can be observed.
      **Verify:** `popup.spec.ts` (8) is **unedited**; one case here stages the **same mailbox, with
      the same verdicts, on both surfaces** and requires a marking on the panel and **none in the
      popup**. **A case that checked only the panel would pass with the prop defaulting to on**, which
      is the failure this case exists for.

- [x] 4.3 A request-count readback across opening the panel, **the same measurement shape
      `background-check.spec.ts` uses** and for the same reason: a count cannot tell two wakes
      listing once from one wake listing twice.
      **Verify:** the count across an adoption listing with the marking implemented equals the count
      without it, **and the case's positive control proves the counter can see a request at all** —
      a case that counts zero passes against a counter that counts nothing.

- [x] 4.4 The threshold is **derived, not picked**: any ceiling comes from `packages/mailbox`'s own
      cadence constants, never a number large enough to be safe.
      **Verify:** a grep of the new cases shows no bare numeric ceiling, and the imported constant
      is named in the case's own comment.

---

## 5. The two comment corrections, and what they are not load-bearing for

- [x] 5.1 **Correct `apps/extension/src/MessageSurface.tsx:128`–`:134`** — `panel-mailbox-choice`
      task 7.2 left this here and said it belonged to the slice that ships the indicator
      (`design.md` D10). It currently states that `extension-client` *"forbids **a surface** from
      indicating that one does"*, which is broader than the promoted text: **both** clauses name the
      popup. The corrected comment says **which clauses** forbid it, on which surface, and that the
      panel's listing carries what the popup's cannot.
      **Verify:** the comment names the popup requirement by its heading; it does **not** say "a
      surface"; and it does **not** claim the marking is permitted by the absence of a prohibition —
      the new requirement is positive and says so.

- [x] 5.2 **Correct `packages/mailbox/src/inbox.ts:105`–`:106`**, which states that
      **`apps/web/src/Inbox.tsx` is the only caller in this repository that reads a verdict at
      all**. This change makes that false in the same commit (`design.md` D10). The correction names
      the panel as the second caller and **keeps the measured `30; w=60` arithmetic intact**, because
      that arithmetic is about the wake's *repeating* cost and the panel is destroyed with its
      surface.
      **Verify:** the sentence no longer reads *"only caller"*; the arithmetic is unchanged; and the
      edit is comment lines only — which is what keeps **`packages/mailbox` held at 166 tests**, since
      a comment is not a test.

- [x] 5.3 Prove this group is **comment-only**. **Verify:** `git diff` over **both** files shows
      comment lines only; each module's **behavioural** diff is empty; and `apps/extension` and
      `packages/mailbox` unit counts move only by the cases this change adds, with the arithmetic
      written down.

- [x] 5.4 Record the correction **in the change's own record**, so a reader who arrives at
      the new requirement and asks *"does anything forbid this?"* finds the answer rather than
      reconstructing it.
      **Verify:** the delta block carries the same statement (it does at proposal), and `design.md`
      D10 is referenced from the group.

---

## 6. Gates and the falsification pass

- [x] 6.1 Run the falsification pass over **every** new assertion in both tiers, with the
      instrument **outside the repository**, restoration verified by **SHA-256 per mutated file**,
      and `dist/` rebuilt from the restored source.
      **Verify:** the table names, per arm, the assertion it was aimed at; and `wrongcatch`, `green`,
      `noop`, `nocompile` and `harness-error` are **each zero or explained by name**.

- [x] 6.2 The arms that must exist by name, because each is a clause a reader would otherwise have
      to take on trust:
      - the marking removed → the row case fails;
      - the marking rendered for `carriesNothing` → the bare-row case fails;
      - **the `undetermined` marking removed** → 4.1c fails. **This arm exists because the first
        draft of this change put `undetermined` in a count instead**, so the row marking is a decision
        somebody could reverse without noticing — and a removal that leaves every other case green is
        what that reversal would look like;
      - the `undetermined` wording changed to assert what the message carries → 4.1c fails on its
        second clause, **and the phrasing sweep fails independently**;
      - **the prop defaulting to on** → the popup case fails. **This is the arm that matters most**:
        it is the difference between a compliant implementation and a violation of a live promoted
        prohibition;
      - `Popup.tsx:314` given the prop → the same popup case fails;
      - **the panel passing the verdicts map instead of its wording** → 4.1a fails, because the rows
        would be marked from a second source that can disagree with them (`design.md` D11);
      - **a `checkFailed` listing marking every row *"could not be read"*** → 4.1e fails. **This is
        the reverse false claim**: those messages **were** read, and `design.md` D3's reconciliation
        with the session's retention is what keeps them apart;
      - the wording changed to *"no verification"* → the phrasing sweep fails;
      - a confidence number added → the same sweep fails.
      **Verify:** each arm's named catcher is the assertion that fails, read from the run's own
      output — not "the suite went red", which this repository has recorded as a different claim.

- [x] 6.3 Run `pnpm verify` and `pnpm test:browser`.
      **Verify:** `pnpm verify` exits `0` **with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory** — it must keep working with no browser installed. **`pnpm test:browser` reports
      website **40** and extension **89** — 82 measured on this tree by counting `test(` per spec,
      plus the 7 cases task 4 adds** — and every run prints a tier summary: a run carrying fewer
      than two tier summaries never reached Playwright and is reported `HARNESS-ERROR`, never
      `passed`. **`AGENTS.md` records the extension's tier at 67 and is behind that 82**, which is
      a finding for 6.4 and 7.6 rather than a reason to write 67 here.

- [x] 6.4 Re-measure every held figure from a reporter run grouped by project. **Verify:** the
      figures in `AGENTS.md`, `docs/ROADMAP.md` and this file are **re-counted, never transcribed**;
      and the six held properties in the preamble are each reported before and after.

- [x] 6.5 Run `openspec validate panel-verification-state --type change --strict` and
      `openspec validate --specs --strict`.
      **Verify:** the first exits `0`; the second reports **14 passed, 0 failed** — the delta adds a
      requirement and touches no promoted spec, so **any other number is a finding**.

---

## 7. Hand-offs, unticked on purpose, and the record

These are **unticked on purpose** and each carries its reason, because a task left unticked reads as
an oversight and this repository has recorded both mistakes.

- [ ] 7.1 **Deliberately unticked — open a real browser, open the panel, and look at it.** An agent
      opening a panel is not the judgement this asks for. **No test in either tier reads a rendered
      pixel**, so whether a row's marking is legible, scannable, and obviously distinct from the
      sender and the subject it now sits under is **outside every gate here**. The same reason leaves
      `panel-mailbox-choice`'s 7.1 and `side-panel-surface`'s own §10 items unticked, and it is
      carried forward rather than re-decided.

- [ ] 7.2 **Deliberately unticked — a human confirming the panel is reachable at all.** With
      `openPanelOnActionClick` unset, the panel is reachable only through Chromium's own side-panel
      entry point, and **no instrument in this repository reads a browser's own UI**
      (`design.md` D9). Every case here drives the panel document directly, so reach is **not
      measured** and nothing in this change's evidence speaks to it.

- [x] 7.3 **Deliberately not done — the singular-record merge**, carried forward from
      `panel-mailbox-choice` 7.3 (`design.md` D7 of that change). Still **unblocked and un-taken**,
      and a following slice that acts on it **must own the content script's offerable set**. A
      marking showing the newest mailbox's verdicts while the chooser offers older ones does not
      touch this, because the panel's listing follows the mailbox the chooser resolved — and that is
      already an asserted fact rather than an argument, in `Panel.test.tsx:1313` (*"makes the chosen
      mailbox the one the panel shows, and hands the session that one"*), which stages **two**
      mailboxes. **A second case for an arm that already has one is how a suite grows a number that
      reads as coverage**, so none is added.

- [x] 7.4 **Recorded rather than fixed — the popup also pays for verdicts it may not show**
      (`design.md` D13). `Popup.tsx:142` calls the full `session.restore`, so the popup spends one
      body read per message on a verdict its own promoted requirement forbids it from rendering.
      **The popup can be shown to be rendering no verdict today, and the reason is structural**:
      `MessageList`'s props are `{ state, onOpen }` and nothing else (`MessageSurface.tsx:142`–`:148`),
      so the shared component has **no channel** to render one through — which is exactly why adding
      that channel needs the opt-in, and why this is a finding rather than a stray observation.
      **Switching the popup to `restoreSummaries` would change a surface this delta does not
      describe**, in the one area with a live prohibition, on the strength of an optimisation.
      **Hand this to the root orchestrator as a candidate, and do not edit `Popup.tsx` in this
      change.**
      **Verify:** `Popup.tsx` is unchanged by this change's diff, and the finding is reported.

- [x] 7.5 **Hand-off to the root orchestrator:** `docs/ROADMAP.md`'s Project Status cursor is
      **root-owned** and is updated at proposal by the agent that owns it, **not here**.
      **Verify:** this change's `git diff` over `docs/ROADMAP.md` contains no line this group
      authored.

- [ ] 7.6 Update `AGENTS.md` (and `docs/` where a count is quoted) with **measured** figures only.

      **Left unticked at apply, and the reason is ownership rather than the judgement.** `AGENTS.md`
      and `docs/ROADMAP.md`'s Project Status block are **root-orchestrator-owned**, and this stage was
      explicitly forbidden from editing either. **Every figure this task asks for has been measured
      and is handed over in `## Amendments recorded at apply` below**, so the tick is waiting on the
      owner rather than on a measurement — and **a task left unticked with a measured hand-off behind
      it reads as an oversight only if the hand-off is missing**, which is the same reason 7.1 and 7.2
      carry their reasons inline.
      **Verify:** the extension's unit and browser counts, the boundary count at **53**, and
      `manifest.json` byte-identical are **re-counted**, not transcribed from this file or from a
      previous session's summary. **`AGENTS.md` is in `.prettierignore`, so a green `pnpm verify`
      says nothing about these lines** — which is recorded because it has been the reason a stale
      figure survived two milestones.

---

## Amendments recorded at apply (2026-10-13)

**Every figure below was measured by running the thing, not read from a previous session's summary,
and every claim that could not be measured is named as such.** Counts come from a
`--reporter=json` run **grouped by project**, never off a summary line.

### A1. The falsification pass measured **13 arms**, and commit `b271580`'s message claimed ten

**The commit message's figure was unsubstantiated when it was written, and this stage's instrument
measured a different number.** The full table is in **A2**. **`wrongcatch`, `noop`, `nocompile` and
`harness-error` are all zero** across all sixteen tier-runs, and restoration was verified by
**SHA-256 per mutated file** with **0 failures**; a 504-file fingerprint after the pass reported
**zero residual changes** and `dist/` was rebuilt from the restored source.

**One arm is a green on purpose, and it is not counted as a catch — see A3.**

### A2. The table, per arm, with the assertion each was aimed at

**Every `caught` row names the case that failed, read from the run's own output. `alsoCaughtBy`
lists other cases about the *same property*, which is an attribution to record rather than a rival
catcher.**

| arm | mutation | tier | outcome | catcher |
| --- | --- | --- | --- | --- |
| M1 | the popup given the prop (`Popup.tsx`) | browser | **caught** | *renders no marking in the popup for the mailbox the panel marks* |
| M2 | the prop **defaulting on** instead of absent | unit | **caught** | *renders the shared listing with no marking at all when no surface asks for one* |
| M2 | " | browser | **caught** | *renders no marking in the popup for the mailbox the panel marks* |
| M3 | `carriesNothing` given words | unit | **caught** | *gives real words to every verdict but the one that must carry none* (+3 more) |
| M4 | `undetermined` folded into `carriesNothing` | unit | **caught** | *says on an undetermined row that the message could not be read* (+4 more) |
| M5 | the `verdictFor` default removed | unit | **caught** | *…and nothing about its contents* (+5, incl. `packages/mailbox/src/inbox.test.ts`) |
| M6 | the row marked from a passed-in map | unit | **caught** | *marks a code row and a link row with their own words, and tells them apart* |
| M6 | " | browser | **caught** | *names a detected code on one row and a detected link on another, and tells them apart* |
| M7 | wording loses *"could not be read"* | unit | **caught** | *says what the session does not know and never what the message holds* |
| M8 | `checkFailed` marks a read row undetermined | unit | **caught** | *keeps the verdicts a failed check''s listing already carried* |
| M8 | " | browser | **caught** | *keeps a marked row and what it was marked with, when the next check fails* |
| M9 | the stale comment at `MessageSurface.tsx` | unit | **green, predicted** | none exists — see **A3** |
| M10 | a confidence number added | unit | **caught** | *carries no forbidden phrasing, in the wording or in any sentence this module declares* |
| M11 | wording changed to *"no verification"* | unit | **caught** | the same phrasing sweep |
| M12 | the marking removed | unit | **caught** | *renders exactly the four wordings, on their own rows, and nothing on the fifth* |
| M13 | a marking rendered for `carriesNothing` | unit | **caught** | *leaves a row the session read and found nothing bare, and certifies nothing about it* |
| M13 | " | browser | **caught** | *leaves the row bare when the message was read and carried nothing* |

**Sixteen tier-runs over thirteen arms: fifteen `caught`, one predicted green.** **Every arm named
by 6.2 is present** — marking removed (M12), `carriesNothing` marked (M13), `undetermined` marking
removed (M4), `undetermined` wording asserting contents (M7), **prop defaulting on (M2)**,
`Popup.tsx:314` given the prop (M1), `checkFailed` marking every row (M8), wording to *"no
verification"* (M11), a confidence number (M10).

**One arm is in the table that 6.2 does not name, and it is the one that caught the most: M5**, the
`verdictFor` **default** removed. Removing it is a change in `packages/mailbox`, which this delta
does not touch, and **it failed five cases across two packages** — which is the measurement that the
panel's marking rests on a *defaulted* lookup rather than on a lookup of its own.

### A3. M9 is unfalsifiable by any assertion, and it is recorded as a green rather than counted

**M9 edited the stale comment 5.1 corrects.** **No assertion in either tier reads a comment**, so the
suite cannot fail for it. It is filed as **`green, predicted`** and **excluded from the caught
count** — **a survivor means the assertion did not catch it, never that the assertion is too weak,
until the mutant has been read and shown to be the thing it claims**, and this one is read and shown
to be a comment.

**A green that was predicted before the run is a measurement. A green that was explained afterwards
is a rationalisation**, and this is why the instrument recorded the prediction rather than the
outcome. **It was also left in the tree on purpose**: 5.3's claim that this group is comment-only is
established by `git diff` over both files, and deleting the comment would destroy the evidence for
the very task that created it.

### A4. Five defects in the falsification instrument, all found by running it

**Recorded because an instrument's own defects are the ones nobody else finds.**

1. **A backup taken per EDIT rather than per ARM**, so a two-edit arm's second copy captured the
   half-mutated file. **SHA-256 caught it** — which is the check earning its place — but eight arms
   then read `nocompile` spuriously. The tree was repaired via `git checkout`.
2. **Nested double quotes inside `cmd.exe /d /s /c "…"`** made Playwright read the `-g` pattern's
   words as test-file regexes, and every arm reported `Error: No tests found`.
3. **The classifier read any second failure as `wrongcatch`.** Corrected so the *intended* catcher
   decides and other cases are reported as `alsoCaughtBy` — **a catcher naming an assertion about
   the same property is an attribution to record; one naming an unrelated assertion is the real
   defect.**
4. **A `playwright --list` preflight was missing**, added, and it confirms `side-panel.spec.ts`
   collects **20** before any mutation is applied.
5. **`pnpm.cmd` cannot be spawned from Node on this machine** (`EINVAL`), so the harness invokes
   `node <cli> <args…>` as an argument array with no shell.

**One arm was mis-authored here rather than by the product** — M6 declared the prop without
destructuring it, which is `TS2304` — and it was **repaired and re-run** rather than filed as a
survivor. **`nocompile` is its own outcome precisely so that a mutation which cannot compile is
never filed as a catch.**

**And one cosmetic defect the table still carries:** **M9's `total` column reads `56` while its
outcome is `green, predicted`.** The outcome and catcher columns are the reliable ones; the `total`
column is not, for that row. **A table with a column that is wrong for one row is a table whose
columns are not all evidence**, so this is recorded rather than left for a reader to reconcile.

### A5. A 60-run block measured **nothing**, and the recovery is the recorded part

**The block's own tally read `runs=60 passed=0 failed=0 harness-error=60` at `exit 0`.** Its
classifier looked for `Tests  <n> passed | <n> failed | <n> tests`; **Vitest prints
`Tests  1214 passed (1214)`** — the counts are in parentheses and the line never ends in the word
`tests` — so the pattern matched **0** times on 60 green runs. **The suite passed 60 times and the
instrument reported that it had measured none of them.**

**The 60 runs were real and their full output was on disk**, so the measurement was **recovered by
applying the corrected classifier to the captured logs** rather than by spending another 17 minutes:
**60 runs, 60 passed, 0 failed, 0 harness-error, and all 60 summary lines identical.**
**The fix reads the line Vitest actually prints, and a run with no `Tests` line is *still*
`HARNESS-ERROR`** — the failure mode was preserved rather than deleted, and the repaired classifier
also requires **exit code and summary to agree** before a run counts, which is how the next finding
surfaced.

### A6. `tests/architecture/boundaries.test.ts` is **not concurrency-safe**, and it loses restores

**Measured, and it is a finding about an instrument rather than about the product.** That suite's
positive controls **plant probe files into the real working tree** and read them back —
`packages/mailbox/__framework-rule-probe.ts`, `packages/providers/__storage-rule-probe.ts`, and two
that **edit real tracked files in place**: `apps/web/index.html` (four planted
`<link src="https://fonts.example.invalid/geist.css" />` before `<div id="root">`) and
`package.json` (a planted `"test:live-permission": "node live-host-permission.mjs"` script, with
the trailing newline stripped).

**Four concurrent `pnpm test` processes therefore delete each other's probes mid-read**, and **all
20 runs went red with `ENOENT`**. Worse, the race **loses restores**: when the block finished, both
tracked files were **left dirty in the planted state**. **Both were restored and verified
byte-identical to `HEAD`** (`index.html` blob `ab4d77d…`, `package.json` blob `63fa0269…`, both
`git hash-object` equal to `git rev-parse HEAD:<path>`).

**The consequence for this repository is durable and is the point:** **a flake or falsification
harness must never run this suite in parallel**, because the failure it produces is a red tree
rather than a red test, and **a harness that leaves planted probes behind looks like a product
defect on the next run**. No repair is proposed here — **one serial run never collides**, so this is
a recorded property of the instrument and a constraint on how any future block is written, not a
defect in a shipped test.

### A7. The Panel case is load-sensitive, measured, and deliberately **not** repaired

**One `pnpm verify` run went red on
`Panel.test.tsx > names the mailbox this page resolves to and the provider that served it`** with
`Unable to find role="heading" and name "guerrilla"`. **The DOM it printed is the whole finding**:
the panel was still on *"Asking that page which host it is on…"*, so the wait released the case
before `resolveThePage` had published anything.

**The rate, measured three ways, and the third is not a valid measurement:**

| instrument | runs | this case failed | tree corrupted |
| --- | --- | --- | --- |
| serial, unloaded | 60 | **0** | no |
| serial, 6 CPU burners | 6 | **0** | no |
| **4 concurrent `pnpm test`** | 20 | **8** | **yes — every run** |

**So the rate on any clean instrument is 0 in 66.** The 8 of 20 appears **only** under concurrent
vitest, which is exactly the condition that corrupts the tree (**A6**), so it is not a measurement
of this case.

**Decision: not repaired, and explicitly not by a threshold.** Raising `findByRole`'s timeout would
be **the recorded defect with a larger number** — it does not establish the precondition, it buys
time, and it drifts the first time the machine changes. **The isolation shape available** is the one
the file's own ninth recorded precondition defect already uses (`Panel.test.tsx:521`) — a cheap
signal, then a synchronous read — and it is **not** applicable unchanged, because
`resolveThePage` calls `setReading` **before** `await records.loadSiteMailboxId(...)`
(`Panel.tsx:269` against `:276`), so the sibling's signal is **strictly earlier** than the heading
this case asserts on.

**Three reasons not to make the change anyway.** **The case and the code path it exercises are both
untouched by this change** — the `Panel.test.tsx` diff's hunks are at 31–47, 111–123 and 1755+, and
`Panel.tsx`'s are an import, one prop and a comment. **A repair whose failure I cannot reproduce on
demand is a repair I cannot falsify**, and this repository's recorded rule is that a property no
mutation can break is not a property. **And the same file already records this class as
load-sensitive for the sibling case**, so the finding is **recorded, not novel**, and the next reader
has it.

### A8. `pnpm test` can exit `1` with **zero failing tests**, under load I supplied

**Two of the six burner runs printed `Tests  1214 passed (1214)`, `Test Files 62 passed (62)`,
`Errors 1 error`** — `[vitest-worker]: Timeout calling "onTaskUpdate"` — and exited `1`. **That is
the burners starving Vitest's own worker RPC**, not a product defect and not a test failure, and it
is recorded because **an exit code with no named failure beside it is ambiguous in the direction that
is hardest to read.** A classifier that counted exit codes alone would have filed two reds naming
nothing; one that counted summary lines alone would have called two green runs red.

### A9. Held properties and measured counts

| property | before | after | |
| --- | --- | --- | --- |
| `apps/web` | 125 | **125** | **held** — this change touches no website file |
| `packages/ui` | 38 | **38** | **held** — no token, no class hook, no rule (D5) |
| `packages/storage` | 86 | **86** | **held**, and `git diff --stat` over it is **empty** |
| `packages/mailbox` | 166 | **166** | **held** — 5.2 is comment-only, and a comment is not a test |
| boundary assertions | 53 | **53** | **held** — no rule added, 3.3's table names the instrument for each property |
| `manifest.json` | `313e1bc7…ea3` | `313e1bc7…ea3` | **byte-identical** |
| `apps/extension` unit | 438 | **451** | **+13, all new cases**: `Panel.test.tsx` 38→**44**, `panel-copy.test.ts` 5→**12** |
| **total** | 1201 / 62 | **1214 / 62** | 62 files unmoved: both files above already existed |

**Unmoved and re-counted, not transcribed:** `packages/core` **54**, `packages/providers` **92**,
`packages/mail-parser` **149**, `apps/web` **125**. **`apps/extension` moved by 13 and by nothing
else**, which is how this change shows it added cases and no behaviour outside the panel's own
surface.

**Browser tier, `pnpm test:browser`: website 40 passed, extension 89 passed, exit 0** — the 89 is
**82 measured on this tree** by counting `test(` per spec **plus the 7 cases task 4 adds**, exactly
as 6.3 derives it.

### A10. OpenSpec validation

**`openspec validate panel-verification-state --type change --strict` → `Change
'"'"'panel-verification-state'"'"' is valid`, exit 0.**
**`openspec validate --specs --strict` → 14 passed, 0 failed** — the delta adds a requirement and
touches no promoted spec, so **any other number would have been a finding.**