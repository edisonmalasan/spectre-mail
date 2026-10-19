# Beta diagnostics — design

## D1 — The metrics are per-session, and that is what makes "persists nothing" possible

The four observable goals are all **questions about one session**:

| question | the product already knows it |
| --- | --- |
| did mailbox creation succeed? | `session.open()` reached `ready`, or `failed` with a `SessionFailure` |
| did a message arrive, and how long after? | `InboxState` reached `checked` with a listing, and the elapsed time between the create and the listing |
| which provider failed, and how? | one of the eight `NormalizedErrorCode` values |
| was the field filled, and why not? | the in-page recogniser's own answer: `filled`, `noField`, `fieldHoldsText`, `notTopFrame`, `notActedOn` |

**Every one of those is a fact about a session that is still open.** None of them needs to outlive
the tab, and that is the observation the whole change rests on:

**A measurement that does not outlive the session it happened in does not need a place to be
stored.** There is no third persisted area, no new record kind, no adapter, no store, and no
migration. **The privacy document's claim — *"No persisted state anywhere outside the two areas
named in sections 1 and 2"* — stays true as written, and the requirement this change writes is
about it staying true rather than about amending it.**

**A design that reached the same four answers by persisting counters would have needed a third
area, a `MODIFIED` to the privacy claim, a new adapter in two places, and a migration for every
device that already holds a mailbox.** The same answers cost a counter in memory instead. **The
difference between the two designs is the difference between a feature and a schema.**

## D2 — What the diagnostic may hold, and why the list is short

A diagnostic that could hold anything would eventually hold something it should not, so the
requirement names the shape rather than the absence:

- **counts, never content** — how many times, not what;
- **no address, no message id, no subject, no sender, no hostname, no URL** — the product's own
  privacy claim says *"Nothing of a page beyond the hostname the extension is beside — no URL, no
  form, no field, no content"*, and a diagnostic that counted a hostname would be a record the
  privacy document does not declare;
- **an elapsed time, not a timestamp** — a duration says how long a thing took and cannot be
  turned back into when the person was there;
- **a provider's normalized code, never a provider's raw body** — `RATE_LIMITED` is the fact;
  the response that carried it is not.

**The rule behind the list is that a count of something is not a record of it**, and a duration is
the one time-shaped value that is safe because it cannot be placed on a calendar.

## D3 — The grounding check cannot see the mismatch, and that is a finding of its own

`privacy-disclosure`'s requirement says each entry of the *does not collect* list carries a pointer
that **resolves**, and that *"the document itself SHALL NOT be an acceptable pointer"*. The check
proves the claim is **grounded**.

**It cannot prove the requirement the pointer names says what the claim asserts.** Measured on this
tree, the last row's claim — *"No persisted state anywhere outside the two areas named in sections 1
and 2"* — rests on a requirement whose operative clause is *"a client SHALL reach its own persisted
state only through the storage layer's contracts"*, **plural, and amended to add a second and a third
record kind as their own contracts**. **The requirement permits exactly what the claim forbids.**

**The requirement's own note says the limit**: *"Grounding is not completeness."* **This is not a
completeness gap. It is a support gap**, and the check has no shape for it.

**The change does not widen the check**, because widening it means deciding what every requirement
*ought* to say, which is a research project. **What the change does is make the claim true**, and
add a check of the *specific* kind the claim needs: **that nothing the diagnostic holds is
persisted** — a claim about the tree, which the tree can answer.

## D4 — The two uncollectable goals are recorded as uncollectable, and that is the deliverable

**"OTP detection accuracy" needs ground truth, and this repository has never received verification
mail from any service.** The corpus in `packages/mail-parser` is **authored**, carries
`synthetic: true` on every fixture, and says so in its own words. **A detection's accuracy against
a corpus the repository wrote itself is a measurement of the corpus**, and reporting it as *OTP
detection accuracy* would be the most flattering available misstatement.

**"Extension compatibility issues" is a bug report, not a metric.** Counting them would need a
channel to receive them, and a channel is a server, an account, or an email address — **all three of
which the privacy document says the product does not have.** The honest answer is that the goal is
met by a person reporting a problem, not by a number the product keeps.

**And the roadmap's own line settles what the record is for**: *"Do not optimize around vanity
metrics yet."* **A goal that cannot be measured is a goal that must be recorded as unmeasured, not
satisfied by a number chosen to fill it.** The document this change ships is therefore as much a
deliverable as the diagnostic is.

## D5 — "Site-specific UI conflicts" is the one that is partly collectable, and the part is worth
### naming

The in-page control lives in a **shadow root**, and a shadow root is exactly the thing that lets a
page's stylesheet reach a control. The product can therefore detect the conflict it is exposed to:
**its own control's computed geometry and visibility**, read from inside the shadow root.

**That is a measurement of the conflict, not of the site.** It says *"the control I placed is not
visible on this page"*, and it says **nothing about which rule did it** — the page's stylesheet is
the page's business, and a diagnostic that named a selector would be holding a piece of the page.

**So the diagnostic can report a conflict happened and cannot say whose it was.** The requirement
should say exactly that, because the difference is the difference between a measurement and a
fingerprint.

## D6 — What this change predicts, so the predictions are falsifiable

- **`packages/storage` is unmoved, at 103.** A diagnostic that persists nothing adds no adapter, no
  store and no key, and **a rise would mean a record was added that the requirement forbids.**
- **`packages/mailbox` and `packages/providers` are unmoved.** The session's outcomes are already
  states; the change reads them.
- **`apps/web` and `apps/extension` rise**, and the browser tier rises with them.
- **`tests/architecture/boundaries.test.ts` stays at 53**, and the new check is a **new file** rather
  than a new rule in that one — because the property is *"nothing the diagnostic holds is persisted"*,
  which a **rule about which module may import which** cannot see.
- **No new record kind appears in `docs/PRIVACY.md`'s sections 1 and 2**, and the *does not collect*
  list keeps its last row **unchanged**, which is the whole point.

## D7 — What this change cannot establish, stated rather than smoothed over

- **No number about a real user.** The diagnostic is a *shape*, and a shape is not a measurement. The
  roadmap's goals are met by people using it, and this change ships the thing that lets them.
- **Nothing about detection accuracy**, and nothing about how often a provider fails in the wild.
- **No rendering judgement.** Whether the diagnostic *reads* well is a human's call, and no test in
  this repository reads a rendered pixel.
- **The diagnostic is not a substitute for a beta's own evidence.** It records what one session did;
  it cannot record what a *user* concluded, and the roadmap's "extension compatibility issues" is
  the goal that most clearly needs the second thing.
---

## D8 � A root repair to a shipped instrument, found by running the gate rather than reading it

**This section is about a change that is not this one.** `tests/architecture/branding-audit.test.ts`
belongs to `branding-check`, which is archived. It is recorded here because **the gate it belongs to
was unreliable, and an unreliable gate is a defect in the tree regardless of which change shipped
it** -- and because the repair was found by *running* the gate, which is the only way a timeout
finds itself.

**What was observed.** Four consecutive `pnpm verify` runs: three green and one red, the red on
`branding-audit.test.ts` > *"every declared site is a place the shipped tree still carries the name,
in the declared way"*, with the cause stated by the runner and not by the suite:

```text
Test timed out in 5000ms.
```

**The implementation agent for `mailbox-history` had already reported this same case** as *"a rare
red"*, observed once in seventeen full-suite runs, **not** reproducible in sixteen more, and with
**"the mechanism is not established"**. It is now established, and the case is **not rare**: it is
**one in four** on this machine under load, and it is a **timeout**, not an assertion failure.

**Two defects, one function, and both of them are the shape this repository has recorded before.**

**The first: the scan is done three times.** `shippedFiles()` walks the whole shipped tree, and
`shippedNameSites()` walks it again and **parses every file with the TypeScript parser**. The two
cases that use it are the two directions of the same claim, and **each paid for a full walk and a
full parse**. The second one to run is the one that timed out, and the durations say so plainly:

| case | before | after |
| --- | --- | --- |
| *"no place in the shipped tree carries the name without being declared"* | ~2 900 ms | **489 ms** |
| *"every declared site is a place the shipped tree still carries the name, in the declared way"* | **5 725 ms � over the limit** | **0 ms** |

**The repair is memoisation, not a larger ceiling.** A timeout raised to fit a case that does the
same work twice is *"a number picked to be large enough"*, and this repository records that shape
as the defect with a bigger number. **The work is now done once, and the margin went from 1.15x to
10x.**

**The second: the guard that skips the probe file is four lines too late.** The walk calls
`statSync(child)` on every entry **before** it asks `PROBE_FILE.test(entry)` whether the entry is
the probe file. **The scan is concurrent with `boundaries.test.ts`, which stages and deletes probe
files in this same tree**, so a probe file deleted between the read and the stat makes `statSync`
throw `ENOENT` -- **on precisely the file the guard was written to skip.**

That is the `ENOENT ... packages/mailbox/__framework-rule-probe.ts` the implementation agent
reported, and **the repair is to ask the question the guard already answers before asking the
filesystem anything.** It is one line moved, and it removes a class of failure that depended on
another suite's timing.

**Measured after both repairs:** the architecture suite is **118 of 118** green with the probe file
**planted and deleted mid-run**, and **four consecutive `pnpm verify` runs are green** where one in
four was red before.

**And the reader that would have named it matched nothing, which is the fifth time this session.**
The four red runs were read with a pattern that looked for `FAIL `, `� `, `timed out` and `ENOENT`,
**and the failure was `format:check` on the file the repair had edited** -- so the reader reported
nothing on four runs that had failed. **A reader that matches nothing looks exactly like a reader
that found nothing**, and the repair to that is to read the *whole* output rather than to pattern
for the shape the reader expected.

## D9 � Apply-stage record (2026-10-19)

### D9.1 The fold moved to `packages/mailbox`, and the prediction was wrong

**�8.2 predicted `packages/mailbox` unmoved, and it moved.** The fold over a session's states
reads `SessionState`, and `SessionState` is that package's, so **the fold belongs beside the states
it reads** -- and the extension and the website then fold the *same* function instead of each
holding a copy.

**The prediction's reason was wrong, and the prediction is corrected in place.** It said the
session's outcomes are already states and the change reads them, which is true of the *client* --
but the reading is a fold over a *sequence* of states, and a sequence is not a state.

**What the correction bought is the thing the prediction was for.** A copy of the fold in each client
is two implementations that agree until the first edit, and the first edit is the one nobody
reviews. **The fold is now one function, in the package that owns what it folds, and it has no
dependency on the presentation layer** -- it produces numbers and names, and each client wraps them
in `@spectre-mail/ui`'s shapes.

**And one dependency edge was removed rather than added.** `packages/mailbox` does not depend on
`@spectre-mail/ui` and does not now; a shared package depending on the presentation layer would be
backwards.

### D9.2 A shared compiler option was about to be widened again, and the cause was fixed instead

The implementation needed the shared reportable-value definition in both clients, and
`import { PRODUCT_NAME } from "@spectre-mail/ui"` in a client **failed with `TS5097`** -- because
`packages/ui/src/index.ts` re-exported `DECORATIVE`, `PAIRS` and `SURFACE_ONLY` from `./pairs`,
and `pairs.ts` imports `"./contrast.ts"`, and **a client's program cannot hold a `.ts` specifier**.

**`mailbox-history`'s apply stage had already met this obstacle and worked around it with a
subpath** (`@spectre-mail/ui/name`) rather than by fixing the cause -- and the note it left said
the cause was still there.

**The cause is now fixed: the pairs are no longer re-exported from the entry point.** Nothing
outside `packages/ui` read them -- `design-doc.ts` and `pairs.test.ts` both import them relatively,
measured with `git grep` -- **so removing the re-export breaks nothing and makes the entry point
importable at all.** The `./name` subpath **stays**, because a second path to one value is not
worth the churn of removing, and its reason is now recorded where somebody will read it.

**`tsconfig.base.json` is byte-identical to `main`.**

### D9.3 Two hooks, one fold, and a `StrictMode` hazard the fold had to survive

**React's `StrictMode` runs an effect twice on mount**, and the website's `main.tsx` mounts under
it. **A hook that folded on every effect would count one failure as two -- and the count is what a
person is shown.**

So the hook remembers the state it last folded in, and `isNewSessionState` decides whether the one
in hand is new. **The comparison is by identity, not by content**, because a session publishes a
*new* state object on each transition, so identity says "this is a transition" exactly, and two
transitions that look alike are two things that happened.

**And the remembered state is a ref and not a field of the diagnostic**, because a `SessionState`
carries a mailbox, with its address and its credentials -- **and the whole claim of this change is
that the diagnostic holds no such thing.** The unit test for the fold found this: the first version
of it asserted that folding the same state twice counted once, and it did not, because the fold was
not idempotent. **The guard was put where the state is, and the fold stayed pure.**

### D9.4 A line-number map went stale, and it lives in two places

**Adding a surface to the extension moved the panel's heading renderings, and
`branding-audit.test.ts`'s map -- which names line numbers -- went stale.** The suite reported it
**by name**, which is the instrument working: *"the lines at which `PANEL_COPY.title` is rendered"*.

**And the coordinates live in two places** -- the suite's `at:` array and `docs/BRANDING.md`'s own
table -- so **a change to one does not change the other.** This change updated the document and
the suite **still failed**, which is how the duplication was found. **Two copies of a claim is one
copy too many**, and the copy that fails is the one that asserts.

**The repair is the lines the tree actually has, re-measured after every edit above them** -- the
same repair `docs/SECURITY.md`'s citation needed at the last sync, and the **third** forward-compat
defect of a line-number kind in this repository.

### D9.5 Two class hooks were unstyled, and the boundary suite said so

**`boundaries.test.ts` reported `diagnostic__entry` and `panel__diagnostic-entry` as rendered but
unselected.** The repair is two rules **in tokens the surfaces already resolve**, and **no new
token** -- the same repair `in-page-fill` made for the same rule.

**And a third hook, `panel__section`, was removed rather than styled.** The panel's other three
sections carry no class at all and are styled by `.panel section`, so **a class hook nothing selects
is dead weight**, and the panel's own note gives the repair: *have no hook rather than add a rule
for it*.

### D9.6 The conflict clause was withdrawn, and the withdrawal is in the requirement

**The requirement's UI-conflict clause is not delivered**, and the reason is a channel rather than a
difficulty: the content script is the only party that can see its own control, and **the extension
has no message kind that asks it about anything but the host it is beside or a field to fill.**
Adding one is a protocol change, and **a protocol change is a different change from this one.**

**The scenario is removed rather than left in place**, because a scenario that says *SHALL* and is
not met is a requirement the promoted specification would carry and the product would break -- **and
a requirement that breaks is worse than a requirement that was never written.** The history of it
lives in the requirement's own body, which is where a reader looks for what changed and why.

**And the goal is recorded rather than dropped**: `docs/BETA.md` says *site-specific UI conflicts*
is **partly collectable** and says what would be needed to collect it.

### D9.7 The instrument's own defects, and they are the sixth of this shape in this session

The new architecture suite was wrong four times before its tally could be trusted, and **the fourth
is the recorded one about backticks**:

1. **It reported the module that NAMES the forbidden things.** The check for "the diagnostic has
   nowhere to put an address" looked for the *word*, and `packages/ui/src/diagnostic.ts` holds the
   string `"address"` in its own exclusion list. **A scan that reports a file for naming a thing it
   forbids is a scan reporting the file's own list of forbidden things.** The reader now looks for
   a **declaration** -- `readonly address`, or `address:` as a key.
2. **It compared a string to an object.** `Array.includes` compares by identity, so a `RegExp`
   object was never `===` to a string and **every comparison was false** -- *a check that compares a
   string to an object is not a check that fails; it is a check that can only say no.*
3. **It could not tell `/diagnostic/i` from `/diagnostic/`.** `RegExp.prototype.source` does not
   carry the flags, so the comparison read only the source and reported the declared pattern as
   undeclared.
4. **Its own pattern held a backtick**, which is the hazard `branding-audit.test.ts` records: a
   backtick inside a regular-expression literal desynchronises the parser for the rest of the file.
   The pattern is now written `\x60`, with **no backtick character in it at all**.

**And the fifth was in the browser tier**: the diagnostic's own cases failed against a **stale
build** -- the page had not been rebuilt since the component was added, and the failure read as
*"the page rendered no report at all"*. **Restoring a source file is not restoring what the browser
serves**, and the repair is to rebuild before the browser tier runs.
---

## D10 — Apply-stage record (2026-10-19), continued

### D10.1 The page's own tests found two collisions, and both are the page being right

**The report's first shape carried an elapsed duration, and the website's own test caught it.** The
page forbids **any interval of the product's own**, and the test that holds it says why in its own
words: *"The cadence is this product's own choice: no provider limit was measured for the only
provider a browser page can reach, so any figure here would be an invention presented as a
measurement."*

**A report of how long the first message took to arrive is exactly such a figure**, and the page
forbids it.

**And the report's own sentence used the word *gone*.** The page forbids that word in the state
where a provider merely failed to answer, because a word that reads as "gone" tells a person
something false about the only copy of their address -- **and a test cannot tell whose "gone" it
is.** The report's sentence was about *the report*, and the page could not say so.

**Both collisions are the same shape, and the shape is this repository's own:** a word or a figure
that is correct in its own sentence and wrong on the page. **The third shape is removed rather than
kept and unused** -- *a shape with no consumer is a schema to migrate rather than a feature* -- and
the extension had never shown an interval of its own either, so **a report would have been the first
place the product showed a figure of its own.** Mail arrival reliability is reported as **counts**,
which is what the goal asks for.

### D10.2 The falsification harness could not start a suite, and reported every arm as green

**The first run of the harness said `6 of 6 arms green`, and every one of the six had failed.**

The harness ran `pnpm` through `execFileSync`, and **`pnpm.cmd` cannot be spawned from Node on this
machine** -- `EINVAL spawnSync`, the defect this repository has recorded before. So the suite never
ran, the output was empty, and **no failure was found in any arm** -- which reads exactly like a
pass.

**A harness that cannot start a suite reports every violation as uncaught, and that is the most
dangerous shape a falsification instrument can have**, because it looks like the result rather than
like a failure to produce one. The repair is to invoke `node` directly on vitest's own entry point,
and **the harness now runs six suites and reads six failures.**

### D10.3 Two of the six arms found real holes, and both are now closed

**M05 -- a bare hostname in the report was not caught.** The website's own case forbade `"@"`,
`"http"`, `"user@example"`, `"subject"` and `"sender"`, **and a report holding `example.com` passed
it** -- because a bare hostname carries neither an "@" nor a scheme. **A hostname is one of the nine
things the requirement names**, so the list was shorter than the rule it held. The list now includes
one, and the arm is caught.

**M06 -- a row in the document's enumeration that the tree does not back was not caught.** The
check asserted that every record kind the tree persists is declared, **and not that every row the
document declares is backed by the tree.** The falsification pass planted a row and **nothing
failed** -- a check that proves half of its claim and reads as a pass on all of it.

**The reader that found it was also wrong**, and it is the recorded shape again: it pushed the first
cell of **every** two-column row into both lists, and it asked *"is this the extension's table?"* by
testing whether the document mentioned `chrome.storage.local` -- **which it always does.** **A reader
that cannot tell one table from another returns every row, and an assertion over every row proves
nothing about either.** The reader now reads each table's own shape -- the extension's is two columns
and its first cell is the key; the website's is four and its second is the store -- and the check
has the reverse direction.

**A harness that found two holes in the instrument it was written to test is a harness that works.**

---

### D10.4 An interrupted run leaves the boundary suite's probe files in the tree, and the next run is
### red because of them

**This was measured, and it is the reason one of the three verification runs in this change was red.**

`tests/architecture/boundaries.test.ts` stages **control probe files inside the shipped source
tree** -- `packages/mail-parser/src/__fetch-rule-probe.ts` and
`packages/mailbox/__fetch-rule-probe.ts` among them -- and deletes them when the suite finishes. **A run
that is interrupted leaves them**, and the probe file is **a shipped source file**: it is inside
`packages/mail-parser/src/`, so it is in the typecheck's program and in the tree every other rule
reads.

**The sequence, measured:**

```text
before=0
run1 EXIT=1     <- a probe file from an interrupted run was still in the tree
run2 EXIT=0
run3 EXIT=0
```

**And the tree was clean before the first of them** -- `git status` showed one untracked file, and it
was the probe. The red was **not** a defect in this change; it was a defect in a *previous* run of a
different suite.

**It is recorded here rather than smoothed away, because the shape is the repository's own:**
*`a corpus that depends on when another suite deleted its probe files is a corpus that varies with
timing`* is a sentence this repository has already written, and this is the same sentence observed from
the other end -- **the corpus varies, and the run that inherits the variation is the one that looks
broken.**

**The repair is the tree, not a test**: the probe files are deleted before the gates are run, and the
three runs are reported **on a tree measured clean before the first of them**. A red run whose cause is
a leftover from a cancelled run is not a finding about the code, and **reporting it as one would be the
worst kind of rounding** -- it would name a defect in this change that is not in it.

---

### D10.5 Two gate runs at once make each other red, and the cause is the boundary suite's own
### probe files

**This was measured, and it is the root's own doing rather than the change's.**

`tests/architecture/boundaries.test.ts` stages **control probe files inside the shipped source
tree** and deletes them when the suite finishes. **Two `pnpm verify` runs in the same tree
therefore fight over the same files**: one run's teardown deletes the other's probe while the other
is still testing.

**The measurement, from four background jobs run against this tree:**

| job | how it was run | result |
| --- | --- | --- |
| A | **alone** | **exit 0** |
| B | concurrent with C | 1, 1, **2** -- the job died |
| C | concurrent with B | 0, 1, 1 |
| D | **alone** | **exit 0** |

**A run alone is green; a run beside another run is red, and the red is not about this change.**
The repository has already written the sentence this is: *a corpus that depends on when another
suite deleted its probe files is a corpus that varies with timing* -- and here the timing was **two
gate jobs the root started at once**, and the corpus that varied was the one every boundary rule
reads.

**So the rule for this record is a process rule and not a code rule: one gate job at a time, and a
red from a run that shared a tree with another is not a finding.** It is recorded here because the
alternative -- reporting those reds as this change's -- would have named a defect that does not exist,
and because a reader of this file will meet the same red and deserves to know what it was.

