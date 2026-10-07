# Tasks

## 1. Measure before deciding (blocking — D2 and D4 depend on these)

- [x] 1.1 Measure whether Chromium injects the declared content script **without** a matching entry
      in `host_permissions`, using the extension's own tier and a throwaway build. Record the
      observed outcome in `docs/PROVIDERS.md` §4 and in this change's `design.md` D2, including
      whether `host_permissions` had to move.
      **Measured: injected without one, and `chrome.storage.local` was readable *and* writable from
      the content script on the `storage` permission alone. `host_permissions` did not move, so D2's
      preferred branch is the one that happened and `activeTab` stays rejected.**
- [x] 1.2 **Corrected in place, because the measurement contradicted what this task predicted.** It
      predicted that the prototype's own `value` setter is what makes a React-controlled input report
      the address. Measured on real React `19.3.0`: **a plain `input.value = x` reaches the state
      too**, so the setter is not what makes it work, and **the dispatched events are** - assigning
      with no events left the state empty while the field painted the address. D4 is amended, the
      setter is kept as *defensive* for frameworks that keep a value tracker (none measured), and the
      event requirement now rests on an observation.
- [x] 1.3 Confirm the content script cannot reach `chrome.storage` if 1.1 shows it is not granted,
      and record which of the two designs D3's direct read depends on. **A measurement that
      contradicts D3's premise is recorded here and acted on in D3, not worked around in the code.**
      **The condition did not arise: the content script CAN reach `chrome.storage.local`, so D3's
      direct read stands and slice 1 needs no message round trip to a service worker whose lifetime
      is unmeasured.** A second measured fact from the same run is load-bearing for D4's requirement
      wording: **a content script cannot read a page's JavaScript globals** - its `globalThis` is the
      isolated world - so *"the page's own code reads back the address"* is observed through the DOM.

## 2. Build (D1)

- [x] 2.1 Add `apps/extension/vite.content.config.ts` emitting one input as a self-contained IIFE
      with no chunking. **Measured: `dist/content-script.js` is 4.48 kB and carries no `import`,
      no `export`, no dynamic `import(` and no relative specifier.**
- [x] 2.2 Add the second `vite build` to `apps/extension`'s build script, keeping
      `build:extension` as the single entry point so no command in this repository names only one
      of the two builds. **The root's `test:browser` builds both clients, then the fixture, then
      runs the website's tier followed by the extension's — so no command names one of two builds.**
- [x] 2.3 Assert the emitted file carries no module specifier and needs no second file. The
      requirement names the property; the assertion is in the extension's browser tier, reading the
      **built** file rather than the source. **Split into two cases in `manifest.spec.ts`** — one
      asserting the *declaration* and one asserting the *artifact* — because 4.2 replaced the case
      that previously asserted the absence, and one case cannot be both.

## 3. The affordance

- [x] 3.1 One module that reads the extension's `chrome` global and returns the storage area, used
      by **both** the popup and the content script. `main.tsx`'s note changes from "the only file
      that names `chrome`" to the claim that survives a second context.
      **The module was written and the claim turned out to be false, in both directions.** The new
      single-reader rule reported `main.tsx line 41` on its first run: the popup still carried its own
      copy of the read and its own shape check, written beside the new reader. `main.tsx` now calls
      the reader and its note is rewritten rather than reworded — and **the reader was renamed
      `local-area.ts`**, because naming it after the platform made the rule report the two correct
      imports of it. Both findings are in `design.md`.
- [x] 3.2 The affordance, rendered into a shadow root carrying its own minimal stylesheet.
- [x] 3.3 Email-field recognition from the three named signals, and nothing else.
- [x] 3.4 Focus handling: appear on focus of an empty field, at most one on the page, removed on
      blur. **Two focus-ordering defects were found while running it, and neither is derivable from
      the requirement** — both are recorded in `design.md`.
- [x] 3.5 Insertion that reaches the page's own state, dispatching both `input` and `change`.
- [x] 3.6 No form activation of any kind.

## 4. Manifest

- [x] 4.1 Add `content_scripts` with the patterns the shipped surface matches, and whatever 1.1
      requires of `host_permissions`. **`host_permissions` did not move** — it is still exactly the
      two provider origins, and 1.1 measured that the content script is injected without a matching
      entry.
- [x] 4.2 **Replace** the case in `manifest.spec.ts` that asserts no content script with one that
      asserts what the content script declares. Not deleted — the assertion is the point, and the
      amendment belongs here. **The replaced case became two: a positive declaration case and a
      build-artifact case** (2.3), and `manifest.spec.ts` went **6 → 8**. `declares no side panel`
      is kept.
- [x] 4.3 **Keep and extend** *"requests no permission no shipped surface uses"*, so whichever way
      1.1 resolves, a permission nothing uses still fails.

## 5. Browser tier (D8)

- [x] 5.1 A fixture page under the extension's own test tree, holding a React-controlled input and a
      plain one, **served by Playwright's own route interception rather than by a `webServer`.
      Corrected in place, because this task predicted a `webServer` and the suite does not have one.**
      The origin is `https://in-page.invalid`, chosen because `content_scripts.matches` has to name
      the origin the fixture runs on, and that name can never resolve anywhere.
      **The reason is measured rather than preferred:** `AGENTS.md` records this repository's `browser`
      job **hanging five times** in CI because `pnpm preview` spawns `vite` as a child that Playwright
      then hangs shutting down. Choosing that instrument for the suite with the most recorded failure
      modes would be picking the known-bad one on purpose.
      **What this costs, stated rather than discovered:** the fixture is served by Playwright's own
      router rather than by a static file server, so nothing here shows a real server serving a real
      page. The in-page specs also share the context `popup.spec.ts` launches.
- [x] 5.2 Cases for: appearance on focus, absence without focus, absence on blur, one at a time,
      absence on a non-email field, absence on a field holding text, absence with no stored mailbox,
      the address reaching the controlled input's state, the address reaching the plain input,
      both events reaching the page, the page's document text not growing the label, and the
      declared reach matching what the content script matches. **Corrected in place: 17 cases, all
      passing** — the predicted **16** was the count before two requirements each gained a case
      during apply (task 4.1's plain-http case and task 4.2's host-reach case), and those are
      counted rather than argued. Three cases the list does not name: one proving the address reaches
      the controlled input's **state** rather than its `value` attribute, one proving the page's own
      queries cannot see the control at all, and one proving the content script also runs on a
      plain-http page — the second scheme `content_scripts.matches` declares and which nothing had
      exercised until this pass.
- [x] 5.3 **A negative control per form**, and the confirmation that the collection rule in
      `extension-client` still fires — the suite's configuration changed, and a rule that reads a
      configuration must be shown to still read it.
      **Both done, and the negative control turned out to be a defect rather than a formality:** its
      first version planted an escape with `setAttribute` where it needed a selector, so it set an
      attribute literally named `[data-spectre-affordance-button]`, matched nothing, **and reported
      the same answer with and without the escape it was planted to simulate.** The collection rule
      does fire against the changed configuration — `in-page.spec.ts` is collected by the extension's
      suite and by nothing else.

## 6. Boundary rules

- [x] 6.1 The content script names no platform storage API; it reaches storage through
      `packages/storage`. Both contexts read the global through the one module.
      **The first half was already enforced** — the existing client-storage rule's pattern includes
      `chrome.storage` — which is why `local-area.ts` reads the area with `Reflect.get` at all.
      **The second half had nothing holding it, and that is the half this change added:** a rule
      matching the bare identifier, so it catches the reflective spelling the shipped code actually
      uses rather than only the spelling it was written to forbid.
- [x] 6.2 A positive control for every form 6.1 misses, and a negative control, because a
      negative rule with one control is how a gap ships.
      **Both controls ship — and the control's first version destroyed ten source files and lost
      five more unrecoverably.** The rule now scans a **disposable copy** of the tree, so nothing real
      is ever written. The full record, and how the five were rebuilt and verified, is in `design.md`.

## 7. Falsification

- [x] 7.1 Every new assertion above is observed to fail, with the **intended** test named. A
      different failing test is a distinct outcome, not a catch.
      **Nineteen forbidden defects and five probes: 13 caught by the intended assertion, 6 by other
      assertions, 0 survivors.** The first pass found **five** mutations that returned `green`, and
      every one was a defect in this change's own tests rather than in the product — two of them a
      case that **could not have failed at all**, and both are now closed and re-verified by their
      intended cases:
      - the whitespace case used `<input type="email">`, on which the value sanitization algorithm
        reduces `"   "` to `""` before any product code runs, so `trim()` was never load-bearing in
        that fixture. Now `type="text"` + `name="email"`, measured to keep all three spaces.
      - the `isEmailField` table's button row carried no email signal, so it was refused by the other
        two checks and never reached the `tagName` guard it names. Now `<button autocomplete="email">`
        — the button the module's own justification describes.
      A third returned `green` legitimately and is filed as probe `B06`: no browser-tier test can
      falsify it, and the measured reason (the control detaches itself before activation behaviour
      gives it a form owner) is recorded rather than papered over with a weakened assertion. The case
      was additionally given the positive control it never had, so it is demonstrably capable of
      firing. **The full table is in `design.md`.**
- [x] 7.2 `nocompile`, `green`, `wrongcatch`, `noop` and `harness-error` are recorded as
      themselves. A mutation that cannot compile is not evidence about an assertion.
      **All five occurred as distinct outcomes and none is left standing as a pass.** `nocompile` and
      `noop` are both zero in the final run; the harness refuses to report a mutation whose edit
      site does not apply, and refuses to run at all when a compiler is missing. **`harness-error`
      occurred twice in this session's own investigation scripts** — a helper pointed at the
      workspace root's `@playwright/test`, which does not exist, so `node` exited `MODULE_NOT_FOUND`,
      no failing titles were found, and two mutations were about to be filed as uncaught on the
      strength of an output that contained no runner count at all. **A helper is held to the same
      rule as the suite it measures**, and no runner summary is now ever reported as a clean tier.
- [x] 7.3 A mutation removing the *prototype setter* — keeping the direct assignment — must be
      caught by the controlled-input case. If it is not, the controlled-input case is a proxy and
      is rewritten rather than reported as coverage.
      **Amended in place, because the D4 measurement predicts this and the prediction is correct.**
      Three arms on real React `19.3.0` showed a plain `field.value = x` reaches the controlled
      component's state *just as well* as the prototype setter, so removing the setter cannot break
      the case and the controlled-input case is **not** a proxy for it — the setter is defensive, not
      load-bearing. **So this mutation is recorded as a probe expected NOT to fire, and it did not
      fire (`U10`, `probe-not-fired`). The falsifiable half is the one D4 says is load-bearing:
      dropping the dispatched events, which is `B08` — and that one *is* caught, by the plain-field
      case rather than by the controlled one.** Reporting 7.3 as a catch would have meant counting a
      mutation the design had already measured to be inert.
- [x] 7.4 A mutation making the affordance render as ordinary page content (no shadow root) must be
      caught, and one making it overlay every field permanently must be caught.
      **Both are caught by their intended cases** — `B04` by *the page's own queries cannot see the
      control*, and `B14` by *shows nothing until an email field is focused*, the latter failing 16 of
      36. `B14` is also the mutation whose leftover proved the concurrent-harness defect below, so it
      has been the single most informative mutation in this run.
- [x] 7.5 Restoration verified by SHA-256 for every mutated file, and `dist/` rebuilt from the
      restored source.
      **The SHA check passed throughout and was still not sufficient**, which is the finding rather
      than the confirmation: two concurrent instances of the harness each verified their own
      restoration against the bytes they had read at their own start, so a mutation the *other*
      instance applied first became that instance's "original" and was faithfully restored. Four
      leftovers outlived both runs. `dist/` is now removed before every build as well, because
      `emptyOutDir: false` is deliberate and therefore **no build ever removes an artefact a previous
      build emitted** — an 8092-byte `content-script.bundle.js` survived the restored source and the
      correct rebuild beside it.
- [x] 7.6 The harness scripts live outside the repository tree. `pnpm lint` rejects a root `.cjs`,
      and a measuring instrument left in the root becomes something every future lint has an
      opinion about.
      **Held, and it is what made the repair possible**: the instrument that found the four
      leftovers — including the pid lock and the per-mutation signature sweep — lives entirely in
      `%TEMP%\opencode\inpage-falsify`. **The helpers written during the investigation were held to
      the same rule**, which mattered concretely: the throwaway `__probe.test.ts` that measured
      jsdom's value sanitization was deleted immediately after reading its output, because a probe
      left in `apps/extension/src/` is a file every future `pnpm test` collects.
- [x] 7.7 The **boundary** assertion this change adds is falsified too, not inherited as coverage.
      The recorded pass covered `apps/extension`'s two suites and nothing targeted
      `keeps the extension platform global to one module`, so it got its own pass of four mutations.
      **Three caught; the fourth survived and is the finding.** `C04` retargets the no-argument rule
      at `apps/web/src` — a real tree containing no `chrome` — and the suite stays green, because
      every control the rule has plants into a disposable copy and passes the root **in as an
      argument**, so nothing pins *which* tree the rule reads. **A rule scanning nothing reports
      nothing, and a negative assertion is trivially satisfied by refusing everything** — M6 slice
      1's finding arriving one directory over. **Repaired** by planting a probe at a fresh path in
      the real tree, which overwrites nothing and whose failure mode is loud rather than quiet: a
      probe left by a crash is named by the assertion below it. **Re-run after the repair: all four
      caught by the intended case**, restoration SHA-256 verified, no probe left in the tree. The
      instrument was itself wrong three times first — see `design.md`.

### A second falsification instrument is not a licence to run two at once

The first run of this pass produced two result sets that **disagreed with each other** — the same
mutation filed as caught by the intended assertion in one and caught by a different test in the other.
That disagreement is the proof that a tree was moving underneath both instruments, and **both sets
are untrustworthy and neither is cited here.** Two harnesses were run because the first appeared to
finish instantly with no output and was relaunched without being diagnosed first; the diagnosis
should have come before the rerun.

The harness now **refuses to start** when another instance holds a pid lock, because a measuring
instrument that cannot tell whether it is alone cannot report about a tree it may be mutating. That
is the thirty-first recorded instance of an instrument wrong about its own subject — **the first one
where the instrument was two copies of itself**, and the only one where the damage outlived the run.

**A signature sweep was still required after the repair.** The first audit grepped for the one
signature it remembered and reported the tree clean while three mutations were live; a systematic
pass over every mutation's own signature found the fourth. **The finding is not that the audit was
wrong once — it is that a targeted grep is not an audit**, and the record says so rather than
promoting the later, luckier pass into the lesson.

## 8. Gates

- [x] 8.1 `pnpm verify` — with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, so the
      claim stays that every gate runs with no browser installed. Run it more than once; a single
      green is a fact about one execution.
      **Six runs, and the two reds are named rather than the sixth counted.** The first was **red
      on two things and neither was a flake**: `format:check` rejected the two files this change's
      falsification repairs had edited — a gate nobody ran between two rounds of test edits — and
      `lint` reported **three warnings**, not errors, on `e2e/fixtures/in-page/page.tsx`. That
      fixture is a **build entry point** with no exports *because nothing imports it*, and
      `react-refresh/only-export-components`'s premise — that a module is also a component
      library — is not true of it. **The fix was an ESLint block scoped to `e2e/fixtures/` by
      shape rather than a file-level suppression**, so a second entry-point fixture is covered by
      existing rather than by remembering. **The fourth run was red again, on `format:check`
      alone**, on `boundaries.test.ts` after task 7.7's repair — which is the same lesson a third
      time and is why it is stated rather than treated as a surprise: **how many files Prettier
      rejects is not a fixed property of the change, it is a count of edits made since Prettier
      last ran.** A warning is not a failure and `lint` exited 0 anyway, which is why that part is
      recorded as a fact about a red gate rather than about a rule. **The sixth and final run is on
      the tree being committed**, and it is the run this task's exit rests on.
- [x] 8.2 `pnpm test:browser`, ten consecutive runs, counting failures. The precedent is one run in
      three failing on a weak precondition.
      **Thirty runs, in three blocks of ten, 0 failing — all 36 cases on every run.** The second
      block exists because of a mistake worth recording: **a comment-only correction to
      `vite.content.config.ts` landed between the two blocks**, while the first was still running.
      A comment cannot change a test outcome, and that is probably the whole story — but
      "probably" is not a measurement, and the precedent in this repository is a suite that was green
      because a number was chosen rather than measured. **So the second block was run from scratch
      rather than reasoning about the first one's validity**, and both blocks are reported rather
      than the convenient one.
      **The third block is on the tree being committed, with one recorded exception rather than a
      claim of immutability:** a comment in `boundaries.test.ts` was corrected *during* it, to the
      same em-dash convention as the rest of that file. **That file is a Vitest file and the browser
      tier never reads it** — `pnpm test:browser` builds both clients and runs Playwright, so what
      was under test is unchanged — **and the correction is a comment, which is not an input to any
      build or spec.** Stating the exception is the point: a block claimed as "frozen" while a file
      moved underneath it is the same claim this repository has retracted twice. **The `format:check`
      red that edit then produced is recorded at 8.1**, which is where the fourth `pnpm verify` run
      came from.
      **All 20 reported 36 passed, and none reported a single failure.**
- [x] 8.3 `openspec validate in-page-address --strict`.
      **Reported `Change 'in-page-address' is valid`, with `--type change`.** The bare name is
      ambiguous here for the reason this file records elsewhere: `in-page-integration` is a
      promoted spec as of the last sync while `in-page-address` is the active change, so the type
      flag is the whole answer rather than a formality.

## 9. Documents

- [x] 9.1 `docs/PROVIDERS.md` §4 gains the 1.1 and 1.2 measurements, with what each does not
      establish beside it.
      **Landed as a new §4.3 rather than an edit to §4.2**, because §4.2 measured a *probe* and
      this measured the **shipped extension's own tier** — two different instruments, and merging
      them would have lost which one produced each row. **Every row carries its own "what it does
      not establish" column**, including the one that matters most for slice 2: **whether a content
      script may `fetch` a provider origin cross-origin is still unmeasured**, and it is the fact
      that decides slice 2's shape.
- [x] 9.2 `docs/ROADMAP.md`: the M9 slicing decision and the cursor.
      **The cursor reads "M9, slice 1 applied and verified" rather than "M9" alone**, because a
      milestone cursor that names a milestone with a slice half-done invites the next session to
      start slice 2 off the strength of it. Slice 1's line records its **measured** storage
      decision — the round trip it was designed to avoid turned out not to be needed — and the two
      absences are unchanged, still answered by absence rather than by a control that cannot act.
- [x] 9.3 `AGENTS.md`: the reconciled header, the extension's stack entry, the browser tier, the
      counts, and the CI record.
      **Three claims in that file were false the moment this slice landed, and each is deleted
      rather than reworded**: the extension's entry point is **no longer a popup only** (it has a
      content script now, so only the side panel and options page remain declared-absent); the
      persistence layer is **no longer unused by the extension**; and `packages/storage`'s
      IndexedDB entry point is **no longer the only** way the extension persists. The counts are
      **765 across 42 files**, grouped from a JSON report, and `packages/ui` stayed at **38** —
      recorded as the measurement that mattered, because D7 commits this slice to no new token and
      a rise would have meant visual surface no capability describes. **`README.md` was swept on
      the same pass, and two M8-era sentences were false** — `apps/extension` described as
      *"placeholder — no manifest, no service worker"*, and a live host-permission probe deferred
      because *"an extension, which does not exist"* — so both are corrected against what is on
      disk rather than left for the next reader. **One sentence was narrowed rather than
      corrected**: `AGENTS.md` said Chromium *granted* the declared host permissions, and **no case
      in this repository exercises a grant**, because the tier fulfils every provider response
      itself. It now says Chromium **parsed** them, and says why parsing is not granting.
- [x] 9.4 Correct every task above that predicted a count and is wrong about it **in place**.
      **Two were wrong, and both are corrected where they were predicted rather than in a list:**
      task 5.2 said 16 in-page cases and the tier holds **17** (two requirements each gained a case
      during apply), and `design.md`'s reconstruction note said 21 unit cases where the file holds
      **25**. **The boundary-count prediction in `AGENTS.md` was right** (54 → 56) and the
      `packages/ui` prediction was right (**38, unchanged**), and neither was reworded — **a count
      that came out as predicted is left alone, because editing it would cost the reader the one
      property the correction was checking.**

## 10. Deliberately not ticked

- [ ] 10.1 **Open the extension on a real site and look at the affordance.** No test in this
      repository reads a rendered pixel's colour or position, so how the control looks inside
      somebody else's page is outside every gate here — and D7 makes that gap larger than usual,
      because the surface under test is a third party's CSS. An agent opening a page is not the
      judgement this task asks for.
