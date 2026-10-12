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

- [ ] 1.1 Rewrite the comment on `loadInsertableMailboxes` in `apps/extension/src/storage.ts`
      (`:105-131`) so its stated reason for not merging is **true again**: the sentence *"Merging
      becomes right the day a surface lists them"* is now false because **this change is that day**.
      Record that the merge is **unblocked and not done**, name why (`design.md` D7 — a merge
      changes what the **content script** offers, a different capability's observable behaviour), and
      point at the `spectre-storage` scenario carrying the cost that remains.
      **Verify:** the comment states the lapse and the unblocked status, and names the content
      script as what a merge would change.

- [ ] 1.2 Prove this was a comment-only edit. **Verify:** `git diff --stat` over
      `packages/storage` is **empty**; `packages/storage` is **86** tests before and after; and the
      SHA-256 of every file under `packages/storage/` is unchanged apart from nothing at all.
      **A note corrected next to changed code is not a comment-only edit**, and this group exists to
      make that impossible to claim.

- [ ] 1.3 Confirm the requirement it interacts with is **not** amended. **Verify:**
      `mailbox-session` and `spectre-storage` have **no delta in this change**, and
      `openspec show spectre-storage --type spec` is unchanged from `main`.

## 2. The chooser's own words, in `panel-copy.ts`

- [ ] 2.1 Add the chooser's strings to `PANEL_COPY` as data: a name for the group, a per-mailbox
      choice name, and whatever the panel says about **which mailbox it is currently showing**.
      Follow the module's own rule — **one claim per entry, each carrying a comment naming the
      requirement it satisfies** — and **no new string that restates `resolve-for-host.ts`'s rule**.
      **Verify:** `panel-copy.test.ts` (or the existing copy test) passes and every new entry is
      covered by a name-resolution case.

- [ ] 2.2 Add a case that the chooser's own sentences **name no host and no provider**. **Verify:**
      a test reading every new `PANEL_COPY` entry fails when a host-shaped or provider-shaped
      literal is planted in it. **This is the same class of case as the popup's *"names no host in
      the copy it offers"*, and it is the one that would catch a chooser caption claiming a page.**

- [ ] 2.3 Confirm no copy moved. **Verify:** `POPUP_COPY` is byte-identical, and every existing
      `PANEL_COPY` key the two clients read is unchanged — `apps/web` reads `POPUP_COPY` and the
      boundary rule that resolves the website's `Extension preview` labels against it must stay
      green.

## 3. The chooser itself, in `Panel.tsx`

- [ ] 3.1 Add the transient selection state, **keyed by host** (`design.md` D2) — one
      `{ host, mailboxId } | null`, not a map — and apply it **on top of** the `resolveForHost`
      result in the `shown` `useMemo`, **never inside the rule** (`design.md` D3). **Verify:** the
      `resolveForHost` call site is unchanged and `resolve-for-host.ts` is byte-identical.

- [ ] 3.2 Render `panel-held` as a `role="radiogroup"` of one `role="radio"` per mailbox
      (`design.md` D6), each carrying its address as text, `aria-checked` naming the current one, and
      **keeping the newest-first order and the `held.length > 1` gate unchanged**. **Verify:** a
      case asserting the order and a case asserting the gate — **the gate is a product decision, not
      an optimisation**, so it is held rather than left.

- [ ] 3.3 Make a chosen mailbox the mailbox **this panel view is about**: the `record` the
      `restore` effect compares on is the chosen one, and `panel-address` shows it.
      **Verify:** a case that presses the second entry and reads the restored mailbox **and** the
      rendered address, rather than only the list's own state.

- [ ] 3.4 Add `Panel.test.tsx` cases for each new scenario in the delta, and each with the case that
      would catch the opposite: **choosing beside a named host**; **a chosen mailbox surviving a
      re-resolution of the same host**; **the host changing and the rule's answer returning**;
      **choosing beside an unnamed page changing nothing but the view**, with the **positive
      control** that `panel-address` is still withheld — which extends `Panel.test.tsx:931-943`
      rather than replacing it; **a chosen mailbox that `held` no longer holds** being refused
      rather than shown.

- [ ] 3.5 Prove the selection resets on a host change by **falsification, not by inspection**.
      **Verify:** a mutation that keys the state by the wrong host, and one that drops the `shown`
      memo's new dependency, are both caught **by the case aimed at the property** — and each
      reports which assertion caught it, because a catcher naming an unrelated assertion is a
      misattribution rather than a catch.

- [ ] 3.6 Re-point `Panel.test.tsx:614-627`, `:868` and `:940-943`, which read `panel-held` as
      text. **Verify:** they still assert **what the list names and in what order**, reading through
      the entry rather than through `textContent` where the entry is no longer plain text — and the
      positive control at `:940` is still a **positive** control.

- [ ] 3.7 Add a case that the panel **writes nothing** on a choice. **Verify:** a fake whose storage
      seam records every call shows **zero** writes after a press — **and the case fails if the fake
      is made permissive**, which is the shape of a check that cannot fail.

## 4. Styling the new hooks, adding no token and no motion

- [ ] 4.1 Style every new class hook in `apps/extension/src/styles.css`, **using tokens this
      region already resolves** (`--font-mono`, `--type-xs`, `--ink-secondary` and the accent
      already in the panel's rules) — **no new token, no new motion**, per `design.md` D6.
      **Verify:** the boundary rule requiring every rendered class hook to be selected by a
      stylesheet is green, and `packages/ui` is **38**.

- [ ] 4.2 Make the current entry distinguishable **without pressing anything**, because the
      requirement says the panel *names* the most recent ones. **Verify:** a case reading the
      **resolved** selection and a case reading the **rendered** difference, and **both** — a
      radiogroup whose `aria-checked` is stale reads as correct to assistive technology and wrong to
      a person, so one assertion is not enough for the property.

- [ ] 4.3 Confirm **no boundary rule was added**, and say which existing instrument holds each
      property. **Verify:** the boundary count is **53**; `tasks.md` names the rule or case behind
      every property this change introduces. **A rule added where an instrument already exists is
      not coverage**, and a fourth rule added "to prove the work happened" would be exactly that.

## 5. The browser tier

- [ ] 5.1 Re-point the four `side-panel.spec.ts` cases that read `panel-held`: `:211` (absence),
      `:240-245` (**`.allTextContents()` on `.panel__held-address`, which a radio is not** — this is
      a re-point, not an edit), and `:510-512`. **Verify:** each still asserts what it asserted, and
      the order case at `:243-245` still reads the entries in order.

- [ ] 5.2 Add browser cases for the claims the unit tier cannot reach: **a press on a real radio in
      real Chromium changes what the panel shows**, and **it changes what the session restored** —
      read over the recorded provider's own traffic, so a panel that repainted without reconciling
      would be caught rather than passed.

- [ ] 5.3 Add a case that a choice writes nothing **through the platform's own storage API**, in the
      direction that matters: read the association area before and after a press. **Verify:** it
      fails when a write is planted, and its **negative control** — a reader that returned every
      value — is exercised, because a sweep matching nothing satisfies the claim above it for ever.

- [ ] 5.4 Carry the re-pointed and new cases through the one documented command.
      **Verify:** `pnpm test:browser` runs both tiers and **the extension tier's count moves only by
      the cases added here**, named one by one; no existing case is deleted to make a number fit.

- [ ] 5.5 Run `pnpm test:browser` **repeatedly**, not once, and report the tally **with** any run
      that measured nothing. **Verify:** the block instrument prints `HARNESS-ERROR` rather than
      `passed` when a run's output carries no tier summary, and exits on the tally it reports.
      **A first green run is a fact about one execution**, and the defect this tier has recorded most
      often is a race that presents as a rate.

## 6. Workspace gates, counts and the falsification record

- [ ] 6.1 Run `pnpm verify` **with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory**, more
      than once, and record every red with its cause. **Verify:** exit `0` on the recorded runs, and
      `format:check` and `lint` have actually run — the two reds this stage has recorded before were
      one of each.

- [ ] 6.2 Account for every movement in the unit counts by arithmetic, **grouped by project from
      the JSON reporter rather than read off a summary line**. **Verify:** `apps/web` **125**,
      `packages/ui` **38**, `packages/storage` **86**, boundary **53**, and `apps/extension`'s
      movement equal to the cases this change added and nothing else. **A count that moves once has
      been falsified is a count that was measuring a tree before its last repair**, so the arithmetic
      is re-run after the final edit, not once at the start.

- [ ] 6.3 Run the falsification pass: every deliberate violation caught **by the assertion it was
      aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` **all zero**,
      restoration SHA-256 verified per mutated file, `dist/` rebuilt from the restored source, and the
      instrument **living outside the repository**. **Verify:** the surviving cases are **read before
      being filed** — a survivor means the assertion did not catch it, never that the assertion is
      too weak, until the mutant has been read and shown to be the thing it claims.

- [ ] 6.4 Record the **manifest digest** before and after. **Verify:** `static/manifest.json` is
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

- [ ] 7.5 Update `AGENTS.md` (and `docs/` where a count is quoted) with **measured** figures only.
      **Verify:** `apps/web` 125, `packages/ui` 38, storage 86, boundary 53, the extension's unit and
      browser counts, and `manifest.json` byte-identical are **re-counted**, not transcribed from
      this file or from a previous session's summary.
