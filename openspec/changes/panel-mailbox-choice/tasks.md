# Tasks

Seven groups. **Each group lands the tests and the documentation its own work calls for**, so a
group whose work needs neither carries neither. The final group is integration checks only.

**Three properties are held from the first group to the last and are restated here so no group can
be read in isolation without them:** `apps/web` stays at **125** tests and `packages/ui` at **38**,
the architecture boundary count stays at **53**, and `apps/extension/static/manifest.json` is
**byte-identical** before and after. Any movement in the first two is a finding to explain before
anything else is looked at; a movement in the third is a defect. `packages/storage` stays at **86**
and `mailbox-session` is not touched at all.

## 1. Correct the storage note, and change nothing else in storage

- [x] 1.1 Rewrite the comment on `loadInsertableMailboxes` in `apps/extension/src/storage.ts`
      (`:105-131`) so its stated reason for not merging is **true again**: the sentence *"Merging
      becomes right the day a surface lists them"* is now false because **this change is that day**.
      Record that the merge is **unblocked and not done**, name why (`design.md` D7 — a merge
      changes what the **content script** offers, a different capability's observable behaviour), and
      point at the `spectre-storage` scenario carrying the cost that remains.
      **Verify:** the comment states the lapse and the unblocked status, and names the content
      script as what a merge would change.

- [x] 1.2 Prove this was a comment-only edit. **Verify:** `git diff --stat` over
      `packages/storage` is **empty**; `packages/storage` is **86** tests before and after; and the
      SHA-256 of every file under `packages/storage/` is unchanged apart from nothing at all.
      **A note corrected next to changed code is not a comment-only edit**, and this group exists to
      make that impossible to claim.

- [x] 1.3 Confirm the requirement it interacts with is **not** amended. **Verify:**
      `mailbox-session` and `spectre-storage` have **no delta in this change**, and
      `openspec show spectre-storage --type spec` is unchanged from `main`.

## 2. The chooser's own words, in `panel-copy.ts`

- [x] 2.1 Add the chooser's strings to `PANEL_COPY` as data: a name for the group, a per-mailbox
      choice name, and whatever the panel says about **which mailbox it is currently showing**.
      Follow the module's own rule — **one claim per entry, each carrying a comment naming the
      requirement it satisfies** — and **no new string that restates `resolve-for-host.ts`'s rule**.
      **Verify:** `panel-copy.test.ts` (or the existing copy test) passes and every new entry is
      covered by a name-resolution case.

- [x] 2.2 Add a case that the chooser's own sentences **name no host and no provider**. **Verify:**
      a test reading every new `PANEL_COPY` entry fails when a host-shaped or provider-shaped
      literal is planted in it. **This is the same class of case as the popup's *"names no host in
      the copy it offers"*, and it is the one that would catch a chooser caption claiming a page.**

- [x] 2.3 Confirm no copy moved. **Verify:** `POPUP_COPY` is byte-identical, and every existing
      `PANEL_COPY` key the two clients read is unchanged — `apps/web` reads `POPUP_COPY` and the
      boundary rule that resolves the website's `Extension preview` labels against it must stay
      green.

## 3. The chooser itself, in `Panel.tsx`

- [x] 3.1 Add the transient selection state, **keyed by host** (`design.md` D2) — one
      `{ host, mailboxId } | null`, not a map — and apply it **on top of** the `resolveForHost`
      result in the `shown` `useMemo`, **never inside the rule** (`design.md` D3). **Verify:** the
      `resolveForHost` call site is unchanged and `resolve-for-host.ts` is byte-identical.

- [x] 3.2 Render `panel-held` as a `role="radiogroup"` of one `role="radio"` per mailbox
      (`design.md` D6), each carrying its address as text, `aria-checked` naming the current one, and
      **keeping the newest-first order and the `held.length > 1` gate unchanged**. **Verify:** a
      case asserting the order and a case asserting the gate — **the gate is a product decision, not
      an optimisation**, so it is held rather than left.

- [x] 3.3 Make a chosen mailbox the mailbox **this panel view is about**: the `record` the
      `restore` effect compares on is the chosen one, and `panel-address` shows it.
      **Verify:** a case that presses the second entry and reads the restored mailbox **and** the
      rendered address, rather than only the list's own state.

- [x] 3.4 Add `Panel.test.tsx` cases for each new scenario in the delta, and each with the case that
      would catch the opposite: **choosing beside a named host**; **a chosen mailbox surviving a
      re-resolution of the same host**; **the host changing and the rule's answer returning**;
      **choosing beside an unnamed page changing nothing but the view**, with the **positive
      control** that `panel-address` is still withheld — which extends `Panel.test.tsx:931-943`
      rather than replacing it; **a chosen mailbox that `held` no longer holds** being refused
      rather than shown.

- [x] 3.5 Prove the selection resets on a host change by **falsification, not by inspection**.
      **Verify:** a mutation that keys the state by the wrong host, and one that drops the `shown`
      memo's new dependency, are both caught **by the case aimed at the property** — and each
      reports which assertion caught it, because a catcher naming an unrelated assertion is a
      misattribution rather than a catch.

- [x] 3.6 Re-point `Panel.test.tsx:614-627`, `:868` and `:940-943`, which read `panel-held` as
      text. **Verify:** they still assert **what the list names and in what order**, reading through
      the entry rather than through `textContent` where the entry is no longer plain text — and the
      positive control at `:940` is still a **positive** control.

- [x] 3.7 Add a case that the panel **writes nothing** on a choice. **Verify:** a fake whose storage
      seam records every call shows **zero** writes after a press — **and the case fails if the fake
      is made permissive**, which is the shape of a check that cannot fail.

## 4. Styling the new hooks, adding no token and no motion

- [x] 4.1 Style every new class hook in `apps/extension/src/styles.css`, **using tokens this
      region already resolves** (`--font-mono`, `--type-xs`, `--ink-secondary` and the accent
      already in the panel's rules) — **no new token, no new motion**, per `design.md` D6.
      **Verify:** the boundary rule requiring every rendered class hook to be selected by a
      stylesheet is green, and `packages/ui` is **38**.

- [x] 4.2 Make the current entry distinguishable **without pressing anything**, because the
      requirement says the panel *names* the most recent ones. **Verify:** a case reading the
      **resolved** selection and a case reading the **rendered** difference, and **both** — a
      radiogroup whose `aria-checked` is stale reads as correct to assistive technology and wrong to
      a person, so one assertion is not enough for the property.

- [x] 4.3 Confirm **no boundary rule was added**, and say which existing instrument holds each
      property. **Verify:** the boundary count is **53**; `tasks.md` names the rule or case behind
      every property this change introduces. **A rule added where an instrument already exists is
      not coverage**, and a fourth rule added "to prove the work happened" would be exactly that.

      **Measured: 53, and the count is not the interesting half — the table is.** Every property this
      change introduced already had an instrument somewhere in the two tiers, so nothing was added:

      | Property | Instrument that holds it | Tier |
      | --- | --- | --- |
      | Every `panel__held*` hook a client renders is selected by a stylesheet | the existing boundary rule, unchanged | boundary |
      | The newest-first order and the one-mailbox gate | `names the mailboxes this device holds` / `offers a device holding exactly one mailbox no chooser to choose with` | unit |
      | A press makes the session restore the chosen mailbox | `makes the chosen mailbox the one the panel shows, and hands the session that one`; `a press changes what the session restored` | unit, browser |
      | The choice is reset by a host change | `returns to the rule's answer when the page beside the panel changes` | unit |
      | The current entry is distinguishable without a press | `a press draws the checked entry differently, and says so in words as well` (resolved *and* rendered readings, both) | browser |
      | Nothing is written on a press | `writes nothing when a person chooses`; `a press writes nothing through the platform's own storage API` | unit, browser |
      | The chooser's words claim no host and no provider | `the chooser's own copy names no host and no provider in any of the chooser's sentences` | unit |
      | The manifest is unchanged and every declared path resolves | the pre-existing manifest rule in the boundary suite, and `manifest.spec.ts` | boundary, browser |

      **And one gap the falsification pass found, reported here rather than closed with a rule.**
      Mutating `.panel__held-choice[aria-checked="true"]` to `[aria-checked="maybe"]` leaves the
      **boundary** suite green — the rule asks whether the *class hook* is styled, and
      `.panel__held-choice` is still styled. **The property is held at the browser tier instead, by
      the case reading the two resolved styles**, so it is a *scope* finding about an existing rule
      and **not a gap in this change**. Widening that rule to check attribute selectors would be a
      fourth rule added where an instrument already exists, which is the thing this task forbids.

## 5. The browser tier

- [x] 5.1 Re-point the four `side-panel.spec.ts` cases that read `panel-held`: `:211` (absence),
      `:240-245` (**`.allTextContents()` on `.panel__held-address`, which a radio is not** — this is
      a re-point, not an edit), and `:510-512`. **Verify:** each still asserts what it asserted, and
      the order case at `:243-245` still reads the entries in order.

- [x] 5.2 Add browser cases for the claims the unit tier cannot reach: **a press on a real radio in
      real Chromium changes what the panel shows**, and **it changes what the session restored** —
      read over the recorded provider's own traffic, so a panel that repainted without reconciling
      would be caught rather than passed.

- [x] 5.3 Add a case that a choice writes nothing **through the platform's own storage API**, in the
      direction that matters: read the association area before and after a press. **Verify:** it
      fails when a write is planted, and its **negative control** — a reader that returned every
      value — is exercised, because a sweep matching nothing satisfies the claim above it for ever.

- [x] 5.4 Carry the re-pointed and new cases through the one documented command.
      **Verify:** `pnpm test:browser` runs both tiers and **the extension tier's count moves only by
      the cases added here**, named one by one; no existing case is deleted to make a number fit.

- [x] 5.5 Run `pnpm test:browser` **repeatedly**, not once, and report the tally **with** any run
      that measured nothing. **Verify:** the block instrument prints `HARNESS-ERROR` rather than
      `passed` when a run's output carries no tier summary, and exits on the tally it reports.
      **A first green run is a fact about one execution**, and the defect this tier has recorded most
      often is a race that presents as a rate.

## 6. Workspace gates, counts and the falsification record

- [x] 6.1 Run `pnpm verify` **with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory**, more
      than once, and record every red with its cause. **Verify:** exit `0` on the recorded runs, and
      `format:check` and `lint` have actually run — the two reds this stage has recorded before were
      one of each.

      **Measured, and the red is the record rather than something a later green erases.** The gate ran
      **more than thirty times** on this change's tree with
      `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory (`exists=True`, `entries=0`), and it
      produced **exactly one red**: `AssertionError: expected [] to have a length of 1 but got +0`,
      one failing case out of 1201. **It reproduced once, at run 29 of the batch that found it**, and
      did not occur in 55 cheaper runs — so it is **load-sensitive**, which is a fact about the machine
      and not a defence of the assertion. **`format:check` rejected three files once** (Prettier over
      `panel-copy.test.ts`, `Panel.test.tsx` and `Panel.tsx`, none of them run through since the last
      edit) and **`lint` exited `0` throughout**.

      **The repair, its confirmation, and where the reasoning lives.** The case waits now on the
      panel's own host line rather than on the recorder, and it was confirmed **under the condition
      that produced the red**: `Panel.test.tsx` ran **30 consecutive times green — 20 unloaded and 10
      with six busy loops running** — and then three consecutive `pnpm verify` runs came back `0`, each
      reporting `Test Files 62 passed (62)`, `Tests 1201 passed (1201)` and three `built in` lines. The
      mechanism, the ninth recorded *precondition* defect, and the fact that **the asserting line is
      unchanged context in this change's diff** are in `design.md` A6.

- [x] 6.2 Account for every movement in the unit counts by arithmetic, **grouped by project from
      the JSON reporter rather than read off a summary line**. **Verify:** `apps/web` **125**,
      `packages/ui` **38**, `packages/storage` **86**, boundary **53**, and `apps/extension`'s
      movement equal to the cases this change added and nothing else. **A count that moves once has
      been falsified is a count that was measuring a tree before its last repair**, so the arithmetic
      is re-run after the final edit, not once at the start.

- [x] 6.3 Run the falsification pass: every deliberate violation caught **by the assertion it was
      aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` **all zero**,
      restoration SHA-256 verified per mutated file, `dist/` rebuilt from the restored source, and the
      instrument **living outside the repository**. **Verify:** the surviving cases are **read before
      being filed** — a survivor means the assertion did not catch it, never that the assertion is
      too weak, until the mutant has been read and shown to be the thing it claims.

- [x] 6.4 Record the **manifest digest** before and after. **Verify:** `static/manifest.json` is
      byte-identical, which is a stronger statement than a promise not to change it and is what makes
      the permission-traceability claim falsifiable rather than asserted.

## 7. Hand-offs and the things this change deliberately does not do

These are **unticked on purpose** and each carries its reason, because a task left unticked reads as
an oversight and this repository has recorded both mistakes.

- [ ] 7.1 **Deliberately unticked — open a real browser, open the panel, and look at it.** An agent
      opening a panel is not the judgement this asks for. Nothing in either tier reads a rendered
      pixel, so whether a chooser of three addresses is legible, scannable and obviously current is
      **outside every gate here**. The same reason leaves `side-panel-surface`'s own §10 items
      unticked.

- [ ] 7.2 **Deliberately unticked — resolve the `MessageSurface.tsx:128-134` divergence
      (`design.md` D8).** The comment reads `extension-client`'s rule as class-wide and the promoted
      text reads surface-specific. **It belongs to the next slice**, because resolving it means
      deciding whether the panel may carry a pending-verification marker — a question about *"whether
      verification mail is pending"*, which is M11's other undelivered item and not this one. **The
      comment is not edited here**, because editing it picks a side without evidence.

- [ ] 7.3 **Deliberately not done — the singular-record merge** (`design.md` D7). It is **unblocked
      and un-taken**, and the reason is in the note this change corrects. A following slice that acts
      on it **must own the content script's offerable set**, and `spectre-storage`'s existing
      scenario carries the cost that remains until it does.

- [ ] 7.4 **Hand-off to the root orchestrator, not a task this change performs:**
      `docs/ROADMAP.md`'s Project Status cursor, which still reads *"slice 2, not yet proposed"*.
      **Only the root orchestrator may write that block**, so it is named here rather than edited
      here.

- [x] 7.5 Update `AGENTS.md` (and `docs/` where a count is quoted) with **measured** figures only.
      **Verify:** `apps/web` 125, `packages/ui` 38, storage 86, boundary 53, the extension's unit and
      browser counts, and `manifest.json` byte-identical are **re-counted**, not transcribed from
      this file or from a previous session's summary.

      **Measured against a baseline taken at `7a6e875` in a detached worktree, not read from
      `AGENTS.md`** — whose own 1093/58 is stale, because `side-panel-surface` moved it and this
      change did not correct it until now:

      | | baseline `7a6e875` | after this change | delta |
      | --- | --- | --- | --- |
      | total, unit tier | 1187 / 61 files | **1201 / 62** | +14 / +1 |
      | `apps/extension` | 424 / 20 | **438 / 21** | +14 / +1 |
      | `apps/web` | 125 | **125** | — |
      | `packages/ui` | 38 | **38** | — |
      | `packages/storage` | 86 | **86** | — |
      | `packages/core` | 54 | 54 | — |
      | `packages/mail-parser` | 149 | 149 | — |
      | `packages/mailbox` | 166 | 166 | — |
      | `packages/providers` | 92 | 92 | — |
      | boundary assertions | 53 | **53** | — |
      | browser tier, website | 40 | **40** | — |
      | browser tier, extension | 78 | **82** | **+4** |

      **The extension's +14 is accounted for by two files and nothing else**, which is the check this
      task is: `panel-copy.test.ts` is **new at 5**, and `Panel.test.tsx` went **29 → 38**, +9. No
      other file moved by a single test. **The browser tier's +4 is all in `side-panel.spec.ts`**
      (9 → 13); the other nine spec files are byte-identical in case count.

      **`manifest.json` SHA-256 is `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`
      before and after**, and `git diff --stat` over `packages/storage`, over
      `static/manifest.json` and over `resolve-for-host.ts` is **empty** — so 1.2's comment-only
      claim is a measurement rather than a promise.

      **And the browser tier was run eleven more times on the tree this stage finished on** — a block
      of ten plus one that established the block reader's own shape before the block ran — **all
      green at `website=40` and `extension=82`, with `failed=0` and `harness-error=0`**, where a run
      carrying fewer than two tier summaries is reported as `HARNESS-ERROR` rather than counted.
      **Thirty further runs were green before the final edit**, on a tree differing from this one in
      `Panel.test.tsx` alone — **a Vitest file the browser tier's `testMatch` does not collect**, which
      is why the block was re-run rather than the earlier one credited: *a block described as frozen
      while a file moved underneath it* is the claim this repository has retracted twice.
