# Tasks

## 1. Recognise a one-time-code field

- [x] 1.1 Add a content-script module that recognises a one-time-code field from the signals the requirement names — `autocomplete` declaring a one-time code, or a `name`/`id` identifying a code, verification or one-time-password field, or a numeric `inputmode` **together with** such a name or id — and verify by unit cases that a numeric `inputmode` alone is not recognised, that a non-`input` element is not recognised, and that a field declaring itself outranks one identified only by name.
- [x] 1.2 Record in the module's own note that these signals are a requirement rather than a heuristic, so that recognising a further shape is a spec amendment instead of a silent widening, and verify the note names the requirement it serves.
- [x] 1.3 Prove the recognition cases can fail — delete the `inputmode`-alone guard, add a positive-control case planting each forbidden signal, and confirm each mutation is caught by the case aimed at it.
  **Recorded during apply (2026-10-10), because the task asks for a mutation that no longer
  exists.** There is no `inputmode`-alone guard to delete: the recogniser reads `inputmode` and it is
  never load-bearing, so the requirement's third signal is *subsumed* rather than unimplemented (see
  the amendment in the delta's recognition requirement). What was run instead, and caught by the case
  aimed at it: the disqualifying-identity list removed (`recognises no checkout, address or card
  field…`), the untypable-input guard removed (`does not treat an input that cannot receive a typed
  value…`), `autocomplete` matched as a substring rather than as tokens (`recognises the token among
  others…`), and the positive control — `reports a planted qualifying field, so the empty answers
  elsewhere mean something` — planting a field that *must* be found, so a recogniser refusing
  everything would fail the suite rather than pass it.

## 2. Carry a code to a tab

- [x] 2.1 Add one request and answer pair to `protocol.ts` for delivering a code to a tab, narrowed on both sides by the existing pattern, with every unrecognised shape becoming `null` rather than an exception, and verify by unit cases on both narrowers.
- [x] 2.2 Read `chrome.tabs` through the module that already owns the extension's platform global rather than beside it, so the existing boundary rule is worked with and not widened, and verify the boundary suite passes with the rule unchanged and that adding a second reader of the global is reported.
- [x] 2.3 Discover the target tab with the query `design.md` D1 measured — the active tab of the popup's own window — and refuse to deliver when that yields no tab, rather than falling back to any other tab, and verify by a case where the query returns nothing.
- [x] 2.4 Verify that no tab the extension did not name is sent anything, by a case that asserts exactly one tab received the delivery when more than one is open.

## 3. Put the code into the field

- [x] 3.1 Generalise `insert.ts` from an address to a value and update its call sites, keeping the prototype setter, the `input` event and the `change` event in the same order, and verify that the existing address-insertion cases still pass unchanged.
- [x] 3.2 Add a case proving a controlled input receives an inserted **code** through the same path, so the renamed requirement's single set of scenarios covers both callers rather than the address alone.
- [x] 3.3 Fill only into a field that is empty at the moment of filling — not the moment it was recognised — and verify by a case where the field acquires text between the two.
- [x] 3.4 Refuse to fill from a document that is not the top-level one, and verify by a case where a framed document holds a qualifying field.
- [x] 3.5 Submit nothing: verify that no `submit` event reaches the page, that no control inside the form is pressed, and that the code appears in the field while the page's own submit handler observed no activation.

## 4. Ask when several fields qualify

- [x] 4.1 When more than one field qualifies and none is preferred, offer the fields as this extension's own control in the page's shadow root, and verify by a case with two qualifying fields that no field is filled before the person chooses.
- [x] 4.2 When exactly one field qualifies, fill it without asking, and verify by a case with one qualifying field and a negative control asserting the asking control is absent.
- [x] 4.3 When several qualify and one is preferred by the named signals, put that field to the person rather than filling it unasked, and verify by a case covering both the preferred and the unpreferred arrangement.
- [x] 4.4 Remove the asking control once the person has chosen or dismissed it, and verify no control outlives its answer.

## 5. Show the codes in the popup

- [x] 5.1 Render the messages a check returned instead of only their number, and verify by cases that the messages are named and that **no** message is marked as carrying a verification before it has been opened.
- [x] 5.2 Open a message through the shared session and render the codes found in it, and verify that a message already opened by this session costs no provider request — with a positive control that does issue one, so the zero is a measurement and not an inert assertion.
- [x] 5.3 Offer a control per detected code rather than one for the top-ranked code, since no detection is ever reported as certain, and verify a case carrying two codes finds two controls.
- [x] 5.4 Report what the page answered, report an unconfirmed outcome as unconfirmed, and never report a code as filled when no page confirmed it — and verify by a case where the page confirms nothing.
- [x] 5.5 Declare every new sentence in `popup-copy.ts` rather than inlining it, and verify the website's depiction assertion still resolves every label the preview shows against the popup's own copy.

## 6. Prove it in a real browser

- [x] 6.1 Add an extension browser case that drives the **popup document at its own origin**, brings the
  target page to the front, checks the inbox against recorded provider responses, opens a message, and
  puts a code into a page's `autocomplete="one-time-code"` field on one activation — and verify it
  fails when the delivery is removed.
  **Amendment, recorded during apply (2026-10-10).** This task said *"opens a real action popup"*, and
  the browser tier cannot: measured on 2026-10-10, after `chrome.action.openPopup()` the extension
  context's `pages()` was **identical before and after**, because headless Chromium surfaces no page
  object for an action popup, and `chrome.extension.getViews` does not exist in MV3. The substitute is
  the same module from the same bundle at the same origin — the untested link is Chromium's own toolbar
  button, which is not code in this repository — and `design.md` D10 records it. **One arrangement is
  load-bearing and is not a workaround:** a popup opened as a *tab* is its own active tab (measured:
  the query returned the popup's own id, and a send to it reached the page's content script), so every
  case brings the target page to the front first — which is what a real popup's window looks like.
- [x] 6.2 Read the **built** extension's manifest in that case and require that no permission was added, so the requirement is enforced against the artefact that ships rather than the source it was written from.
- [x] 6.3 Prove the case can fail for the reason it exists: mutate the delivery, the emptiness check and
  the asking rule in turn, and confirm each is caught by the assertion aimed at it and not by an
  unrelated one. **The top-frame check is deliberately not in that list, and the reason is a manifest
  fact rather than a convenience** — measured by reading the built `manifest.json` this browser case
  already reads: the content script declares **no `all_frames`**, so no content script exists in a
  subframe at all, and a case built on a framed page would be satisfied by **the script's absence**
  rather than by the check. **A green case there would read as coverage while measuring a different
  property**, which is this repository's most-recorded defect; the check stays in the unit tier, where
  a framed `window` is one line. What the manifest *does* make assertable is that a code reaches one
  document per tab, and `6.1`'s case reads `permissions` from the parsed manifest rather than from
  the file — so the narrowness is enforced against what Chromium parsed, not asserted in prose.
  **Measured, recorded 2026-10-10: 24 deliberate violations across both tiers, 21 caught by the
  assertion aimed at them and 3 recorded as evidence rather than counted; `wrongcatch`, `green`,
  `noop`, `nocompile` and `harness-error` all zero.** The three are named in `design.md` D6 and each
  was read before being recorded rather than being filed as a hole: one was a **broken mutant** — a
  logically identical rewrite, so a green run was the correct outcome and not a statement about the
  requirement — and two were the two halves of the prototype-setter measurement, whose green is the
  **designed** result because `design.md` D4 holds that mechanism in a decision rather than in a
  requirement. Every mutated file was restored and verified by SHA-256, `dist/` was rebuilt from the
  restored source, and the harness lives outside this repository.
  **Amendment, recorded after the pass (2026-10-10).** The tree changed **after** the twenty-four
  arms ran, so this paragraph did not describe the tree that was committed until it was re-measured.
  Reading `fill.ts` against the repository's own idiom for a compiler-forced branch
  (`provider-config.ts`'s `primaryProviderName`, which *handles* the unreachable case rather than
  falling through) found that the single-candidate arm returned `{ kind: "filled" }` from **outside**
  the `!== undefined` guard — a path that writes nothing and reports that it wrote something, and
  `filled` is the one answer in the union that claims anything happened. **No arm was aimed at it and
  none could have been**: the branch is unreachable, and a mutation of unreachable code proves
  nothing. `design.md` D12 records the finding and the repair. **The five arms whose mutated file is
  `fill.ts` — `U05`, `U06`, `U07`, `U08` and `W01` — were therefore re-run against the repaired
  tree**, and all five were caught by the assertion each was aimed at, with restoration verified by
  SHA-256 and `dist/` rebuilt. **A pass reporting "twenty-four of twenty-four" without saying the
  tree moved afterwards would have been reporting a property of a file that was no longer there.**
- [x] 6.4 Run the whole browser tier repeatedly rather than once, and record the run count and the case counts measured from the run rather than predicted.
  **Measured, recorded 2026-10-10: forty consecutive runs in four blocks of ten, `website=40` and
  `extension=63` on every run that produced a measurement.** The tally is
  `passed=39 failed=0 harness-error=1` and **it is reported with the one run that measured nothing
  rather than rounded to a clean forty.**

  **A fourth block was then run against the exact tree being committed, and that distinction is
  measured rather than asserted** — the same point `site-associations` had to make by hand after
  establishing by search that no build or spec reads three documentation files. Here it is a
  timestamp bracket: the block's fingerprint files were written at **04:50:33** and **04:59:12**, and
  **zero of the 413 source files under `apps/`, `packages/`, `tests/`, `openspec/`, `docs/` and
  the root configuration have a write time inside that window** — the latest is **04:40:40**, ten
  minutes before the block opened. **So all ten of that block's runs are on the tree this commit
  ships, and the other thirty are on a tree differing from it in nothing at all.**

  **The instrument refused to call that run a pass, and finding out why took two false hypotheses and
  then a reproduction.** `pnpm test:browser` is `build && build:fixture && web tier && extension
  tier`, so a run with **no** tier summary never reached Playwright — counting it would be counting a
  run that did not run. "A build failed because the falsification pass had just rebuilt the
  extension" was tested and did not reproduce; "two concurrent runs collide" was tested at a
  twelve-second gap and did not reproduce either. **Reproduced deliberately**, two
  `pnpm test:browser` runs started at the same instant: the loser printed `Error: Process from
  config.webServer was not able to start. Exit code: 1` and zero tier summaries, because the
  website tier's `vite preview` runs with `--strictPort` and cannot bind 4173 while the first run
  holds it. `design.md` D13 records the whole thing.

  **And why two streams were running at once was this session's mistake, not a flake.** Stopping the
  block *script* when `fill.ts` changed did not stop its wrapper, so a discarded block series carried
  on against a tree that was being edited and re-measured underneath it. **Its output — three red
  runs and two harness-errors — was thrown away rather than reconciled**, and those reds are now
  explained by the same port collision measured in the other direction. `emptyOutDir: false` is the
  mechanism that makes two builds of the same `dist/` possible at all, and it is already recorded
  here as a cost of the extension's two-part build.

  **The instrument's own behaviour is the part worth keeping:** it printed `HARNESS-ERROR` instead of
  `passed`, it exited non-zero on that count, and its tally and its exit code came from the same
  variables — which is what the `site-associations` block script was rebuilt to do after a
  completed block reported `exit 1` with no explanation and an aborted one reported the same number.

  **And the instrument that established the fourth block's tree was wrong twice before it measured
  anything, which is the sixth and seventh time this shape has appeared and the first time it has
  appeared in a script written to answer a question rather than to run a suite.** Its first version
  stamped into a directory that does not exist, so `Set-Content` failed as a *non-terminating* error,
  the function still returned a line count, and the comparison then read a file that had never been
  written — **printing `files that changed during the block: 1` beside a comparison that never
  happened**, with no file named. A count printed next to a measurement that did not happen is the
  purest form of the defect this milestone has recorded twice already. Its second version excluded
  `dist/` and correctly said so, and then swept in `apps/extension/test-results/` — the extension
  profile directories Playwright creates and deletes per run — so the same comparison reported
  **2930 changed files**, every one of them a browser profile this block had just written. **A
  fingerprint that cannot tell a source file from an artefact the measurement itself produces will
  always report a change, so `test-results/` and `playwright-report/` are now excluded by name and
  the exclusion is stated in the script rather than assumed.** The third version took the
  timestamp bracket above instead of a content hash, which is what made it usable: the earlier two
  were discarded rather than repaired in place, because their output was already wrong.

## 7. Record what this does and does not establish

- [x] 7.1 Update `AGENTS.md` and `docs/ROADMAP.md` with the observed state, including that a code is available only after a check the user asked for, that per-frame delivery is unmeasured, and that nothing here has run on a real signup page.
- [x] 7.2 Count the workspace suites from the reporter grouped by project, and confirm `packages/ui` did not move — verifying that number against the run rather than against a figure written down earlier.
  **Measured, recorded 2026-10-10: `pnpm test` is 1009 tests across 54 files.** `apps/extension`
  **262** (from 151), `packages/mailbox` **158** (from 155), and `apps/web` **125**,
  `packages/providers` **92**, `packages/storage` **78**, `packages/mail-parser` **149**,
  `packages/core` **54**, the architecture boundaries **53** and **`packages/ui` 38 for the eighth
  time** all unmoved. The movement is accounted for arithmetically rather than asserted:
  `apps/extension` 151 + 22 (`code-field.test.ts`, new) + 23 (`content-script-fill.test.ts`, new)
  + 26 (`extension-platform`) + 24 (`protocol`) + 16 (`Popup`) = 262.
  **The boundary count not moving is a second claim and it is load-bearing**: it is the only evidence
  that `chrome.tabs` was read through the module that already owns the platform global rather than
  beside it, because the rule's own count would have risen with a second reader and the planted probe
  (`B01`) is what shows it still fires.
- [x] 7.3 Run `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and record what it proves and what it does not.
  **Ran, exited 0, with the directory created empty and confirmed empty (`entries=0`) before the
  run.** What it proves: every workspace project type checks, lints and formats, the 1009 unit cases
  and 53 boundary assertions pass, and **both** clients build. What it does not prove: anything
  about a browser, a provider or how anything looks — it is a browser-free tier by construction, and
  the browser tier was run separately thirty times.

## 8. Left deliberately unticked

- [ ] 8.1 **A human opens a real signup page, fills a code, and says whether the flow is right.** Not ticked by an agent: no test in this repository reads a rendered pixel, and the surface under test is somebody else's page and stylesheet.
- [ ] 8.2 **A code is copied with the real clipboard in a real browser.** Not ticked: the clipboard
  outcome this milestone can reach — the **mailbox address** — is verified against a stub, and one
  substrate corroborated is not a general licence.
  **Amendment, recorded during apply (2026-10-10).** This task was written as though this milestone
  shipped a *Copy code* control. It does not, and deliberately: `extension-client` keeps the one-time
  **copy** control on its declared-absence list while this change removes only the **fill** control, so
  there is no code to copy here. The task is kept rather than deleted because the stub-versus-real
  limit applies to the address control that does exist, and whoever adds the copy control inherits it.
