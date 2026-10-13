# Design

## Context

The facts this design rests on were measured while writing the proposal, not carried forward.
Re-reading the recorded finding rather than trusting it is what produced the change.

**What the manifest declares.** `apps/extension/static/manifest.json` declares
`permissions: ["storage", "alarms", "notifications", "sidePanel"]` and two `host_permissions`
(the provider origins, in the wildcard path form).

**What shipped code reaches.** Scanning every file under `apps/extension/src` for
`chrome.<permission>` and for the bare token:

> **Correction, recorded during apply (2026-10-13), by `extension-permissions-review`. The table
> this replaces was wrong on all three of its "yes" rows, and it was wrong in the way that matters
> most here — it substituted a different criterion for the requirement's.** The requirement asks
> whether a declared permission is one *"no shipped surface uses"*, and this table answered a
> narrower question — whether a shipped module spells `chrome.<name>` — and then reported that
> narrower question's answer as though it were the answer. **Measured on the shipped tree,
> comments stripped: `chrome.alarms` in `service-worker.test.ts:100` is the only `chrome.<name>`
> occurrence in code anywhere under `apps/extension/src`, and it is a test's forbidden-token list.**
> The other **70** are inside comments — 14 in `extension-platform.ts`, 9 in `storage.ts` — so a
> scan for that spelling would report **all four** permissions unjustified, including the three
> this table called reached.
>
> **The reason is a boundary rule this repository already enforces**: the bare `chrome` token is
> confined to one module, so shipped code reaches the platform through that module's reflective
> read — `Reflect.get(globalThis, "chrome")` — and passes each member's name as **data**. The
> correct criterion is therefore the member name as a string beside that one read, and by it:

| permission | a shipped read of the member, through the reflective read | where |
|---|---|---|
| `storage` | **yes** | `extension-platform.ts` (`"storage"`, `.local`) |
| `alarms` | **yes** | `extension-platform.ts` (`"alarms"`, twice) |
| `notifications` | **yes** | `extension-platform.ts` (`"notifications"`) |
| `tabs` | **yes — and deliberately not declared** | `extension-platform.ts` (`"tabs"`, twice); `tab.url` is withheld without it |
| `sidePanel` | **no** | **none** |

**So `sidePanel` is the only declared permission no shipped module reaches, and `tabs` is a member
no shipped module reaches that the manifest deliberately withholds** — which is what makes the map
in D6 the assertion rather than a scan for reads. A scan would have had `tabs` as its first false
failure, and the repair would have been to declare it.

**The one occurrence of `sidePanel` in shipped source is a doc comment.** It is the word
*"sidepanel"* inside `"sidepanel.html" and "popup.html" are two documents Chromium loads
independently"` in `panel-main.tsx`. **A word that differs from the token by case is not a call**,
and a substring search over `apps/extension/src` is what establishes that, rather than a rule
asserting it.

**What was measured, as a two-by-two.** `apps/extension/e2e/side-panel-runtime.mjs` declares
`VARIANTS = ["control", "base", "tabs"]` and `docs/PROVIDERS.md` §4.6 records the control and the
base:

| | no `side_panel` key | `side_panel` key |
|---|---|---|
| **no `sidePanel` permission** | `control` — `chrome.sidePanel` **`undefined`** | **never run** |
| **`sidePanel` permission** | **never run** | `base` — **present** |

**Two of four cells.** §4.6 records this as *"the permission is one of the two and cannot be
separated from them on this substrate"*, and three later documents — `extension-client`'s
amendment chain, `manifest.spec.ts`'s comment, `AGENTS.md` — carry the sentence forward as though
it described the platform. **It describes the fixture.** The staging machinery already expresses
both missing cells: `permissions` is replaced wholesale and a `null` value deletes a key, so a
variant fragment is two lines.

## Goals / Non-Goals

**Goals**

- Settle the four cells on this substrate and record the result where a reader will look for it.
- Make `extension-client`'s claim about `sidePanel`'s necessity say what was actually measured.
- Close the specification gap the case exposes: the manifest clause forbids *"a permission that no
  shipped surface uses"*, and `sidePanel` is used by **no call** but by a **manifest key** — a case
  the clause neither covers nor is meant to cover, and nobody has had to say which.
- Leave an assertion that fails when a permission is added with nothing behind it, rather than a
  paragraph that would have to be re-read.

**Non-Goals**

- Resolving the alarm that survives a removal (`extension-clear-data` D7, task 9.1).
- The privacy document, the M12 security review, and the provider-terms re-check.
- Any change to `docs/PROVIDERS.md` §4.1.1, §4.4 or §4.5, which are about other subjects.
- **Naming an outcome.** The four cells are run before this design's conclusions are written, and
  neither a hopeful answer nor a pessimistic one may shape the fixture.

## Decisions

### D1 — Measure the two missing cells rather than cite Chromium's documentation

The documentation says a `side_panel` key needs the `sidePanel` permission. **A document is not a
measurement of this substrate, and this repository's rule is that a claim about a platform belongs
in `docs/PROVIDERS.md` measured here.** More concretely: the sentence already in §4.6 *reads* like
a platform limit and is not one, and the only way a reader tells the difference is a fourth cell.

**Rejected:** citing the docs and narrowing the requirement's wording to "Chromium's documentation
requires". It would leave a claim about *this Chromium* resting on a claim about *some* Chromium,
which is the exact substitution §4.1.1 already records as having cost a measurement.

### D2 — Two new variants, each differing from `base` in exactly one entry

`variants/permission-only.json` — `"permissions": ["sidePanel", "storage"], "side_panel": null`.
`variants/key-only.json` — `"permissions": ["storage"]`.

Each differs from `base` in **one** entry, which is the property that makes a difference
attributable. **`control` already differs from `base` in two, and is still a valid cell** — it is
the *baseline* of the two-by-two rather than a controlled comparison against it, and §4.6 already
says so. Stating it prevents a later reader from reading the four cells as four controlled pairs.

**Rejected:** a variant that differs from `base` in both, re-derived. It would answer a fifth
question nobody asked and add a cell to every future re-measurement.

### D3 — The verdict is computed from the cells, and a cell that fails to report cannot produce a positive one

§4.6 records that the run's first verdict *"survived a total measurement failure"* — it was read
from the API-presence stage, a different fixture load from the arms, so an arms stage that failed
completely left the verdict positive. And it records **one run in six failing to dock the panel at
all**, cause undiagnosed.

**Both facts land on this change.** The new cells are API-presence cells, which is the stage that
carries the recorded defect. So: every cell's own observation is printed **and** counted, a cell
that reported nothing is counted as *not observed* rather than as *absent*, and **the verdict is
`answerable: false` whenever any cell failed to report** — the shape D6 of `side-panel-runtime-facts`
already established and this change must not regress.

**Rejected:** running the new cells once and reading the output. The instrument's own recorded
instability is one in six, and a single run at that rate is a fact about one execution.

### D4 — §4.6 is amended in place, not superseded by a new section

The wrong sentence lives in §4.6 and a reader looking for side-panel platform facts goes there. A
new §4.7 would leave §4.6's *"cannot be separated"* standing next to a corrected table, and **two
sections disagreeing about one fact is worse than one section being wrong**, because a reader who
finds the first has no way to know a correction exists.

**The amendment is not conditional.** Both outcomes replace that row.

### D5 — `extension-client`'s amendment chain gains a correction; the correction's *text* is written after the measurement

The requirement states `sidePanel`'s necessity *"was measured rather than assumed"*. **That is true
of `alarms` and `notifications` and overstated for `sidePanel`**, and the correction says so
without converting the requirement's other claims into doubt.

**Why the text is written at apply rather than here:** an amendment paragraph that asserts an
outcome the measurement has not taken would be this repository's recorded *"a green run reports no
history"* defect in prose form — a sentence about a measurement nobody made. The *presence* of a
correction is unconditional; its *content* is not.

### D6 — The instrument is a test-owned mapping, and never a prose check

`manifest.spec.ts` already asserts the permission list in **one direction**: adding a permission
fails. Nothing catches a permission that was added with no reason. The gap is not coverage, it is
direction.

The fix is a **test-owned mapping** in `manifest.spec.ts` — `permission → the `chrome.<name>` call
or the manifest key that earns it` — asserted against the manifest's own contents, plus a
shipped-source scan for the call half.

**Rejected, and the reason matters:** making the requirement's *prose* the source of the mapping. A
rule that a comment can satisfy is not a rule — this repository has recorded that failure twice,
and once specifically in the form *"prose must not be able to satisfy one, because a module that
only describes the coupling it lacks is exactly the defect"*. The mapping lives in the test because
a fixture is where a test's expectations belong, and because a test that owns it cannot drift from
the manifest without failing.

**Rejected:** a boundary rule. A new rule in `tests/architecture/boundaries.test.ts` would make the
count move from **53** for a property `manifest.spec.ts` already half owns, and this repository
records *"a rule added where an instrument already exists is not coverage"*. **`packages/ui` stays
38, `packages/storage` stays 86, `apps/web` stays 125, and the boundary count stays 53** — and
those four numbers not moving is the measurement this design turns on.

### D7 — The finding is not attributed to the change that added the permission

If the four cells say `sidePanel` is unnecessary, **the defect is in the fixture's two missing
cells**, not in `side-panel-surface`'s manifest. That change recorded what was measured and said
what could not be separated; it did not claim more. **An amendment that names the stage that added
an entry as the stage that got it wrong would be the wrong attribution**, and this repository keeps
a running record of the difference between the two.

### D8 — Falsification runs on both new artefacts, and the falsification of the instrument is two-sided

The two variants: mutate each so it declares what its cell is supposed to *not* declare, and the
cell must move — **a cell that does not move when its own manifest changes is measuring nothing.**
The `manifest.spec.ts` case: a probe permission planted in the mapping fails; a probe permission
planted in shipped source **and** absent from the mapping also fails; **and a control that a
mapping entry stops justifying is unaffected**, because a control surviving a mutation is the
control working.

### D9 — Quarantine, and the quarantine list does **not** grow

`side-panel-runtime.mjs` is one of four quarantined `.mjs` probes. The boundary assertion covering
them **is a list, not a per-probe rule** — that is what makes adding a fifth a matter of adding a
name. This change adds no live provider call and **no new probe**, so that assertion is edited only
if the list is where a probe must be named; it is not, because the probe already exists.

## Risks / Trade-offs

- **The measurement could be inconclusive** — Chromium may require the permission for the key *and*
  refuse the panel without either. → Then §4.6's limit survives, **narrowed** from a platform
  property to a property of two cells on one engine, and the recorded finding is that the sentence
  was carried as a platform limit for four changes when it was a fixture gap. **Either outcome is a
  result**, and the design names no preferred one.
- **One engine, one machine.** → Carried in §4.6's own limits, unchanged, and this change adds no
  new claim about another engine.
- **§4.6's one-in-six dock failure** → **Mitigated by D3**: a cell that does not report is not
  observed, the verdict is `answerable: false`, and the run exits non-zero. **A repeatability
  figure without a cause is a number rather than a finding**, so this change records the rate it
  measures and does not claim to have fixed one whose cause is undiagnosed.
- **A removal branch means the shipped manifest changes.** → Declared in advance so the change's
  size is bounded: the *unconditional* work is two variants, one amendment paragraph, one scenario,
  one case, and one §4.6 table. The *conditional* work is one array literal in two files.
- **Writing a spec amendment after measuring inverts this repository's usual order.** → The
  amendment is written **into the change's delta**, never straight into `openspec/specs/`, so a
  gap between the archived delta and the promoted spec remains the defect this repository records
  as "an amendment was recorded in the wrong artifact".

## Apply-stage decisions (2026-10-13)

**Recorded after the work rather than before it, and named as such.** D1-D9 were written before the
two missing cells ran, which is the only reason the branch below could be conditional at all. What
follows is what the measurement returned and what the code did about it, and **nothing here revises a
decision above** - a decision edited after it is answered is a decision recorded for its own
approval.

### D10 - The cells answered the question, and the answer kept `sidePanel`

Four runs of `side-panel-runtime.mjs`, all four complete, all four printing the same four cells:

| cell | `sidePanel` permission | `side_panel` key | `chrome.sidePanel` |
|---|---|---|---|
| `no-permission__no-key` (`control`) | absent | absent | `undefined` |
| `no-permission__with-key` (`key-only`) | absent | **present** | **`undefined`** |
| `with-permission__no-key` (`permission-only`) | present | absent | **present** |
| `with-permission__with-key` (`base`) | present | present | present |

**`key-only` is the cell that decided it, and it is the corner D1 said could not be expressed.** The
key alone gets nothing; the permission alone gets everything, `open` and `setPanelBehavior` included.
**So branch 3.1 was taken: the entry stays, `static/manifest.json` is byte-identical, and the outcome
is an amendment in this change's delta naming all four cells.** Branch 3.2 was not taken, so the
two-line removal it described did not happen, and the amendment paragraph that was already in the
delta stands untouched per 3.3 - **its claim is about what was measured before this change, and
editing it to agree with the new answer would make the record say the correction was obvious in
hindsight.**

**`permission-only` is the finding that changes what the map is for.** A panel document is mounted
from the key, so a reader could reasonably have called the key the cause and the permission the
access token. **The measurement is the other way round**, and that is what forces `sidePanel`'s entry
to be `manifest key` rather than `platform read`.

### D11 - `decide()`'s not-observed check moved *first*, because a refusal must not describe a cell

The four cells are API-presence cells, which is the stage D3's defect lived in, so the repair had to
be inside the verdict rather than beside it. **The check was reordered so a cell that reported
nothing is consulted before any cell that did**, and a non-observed cell prints its own `NOT OBSERVED`
row rather than a value: **"cannot report" and "was absent" print identically otherwise**, which is
the same defect the panel's first version made from a `sidepanel.html` with no `<script>`.

**The reordering is a decision about the failure direction.** A verdict assembled from a subset of
its own cells is decoration, and a *readable* subset is worse than a short one - it looks like an
answer.

### D12 - **This file's Context table is wrong about the spelling**, and the implementation does not use it

Lines 12-26 of this file scan shipped source for `chrome.<permission>` and report `storage`, `alarms`
and `notifications` as reached by "a shipped `chrome.<name>` call". **Measured: after comments are
stripped, that spelling appears nowhere under `apps/extension/src` - zero member-expression hits for
every permission, including `tabs`.** The reason is structural, not accidental: this repository's own
boundary rule confines the bare `chrome` token to one module, so shipped code reads the platform as
`Reflect.get(globalThis, "chrome")` and then takes each member's **name as a string literal**.

**The table is not corrected here.** It is a record of what the design was written against, and
**correcting it in place would erase the only evidence that the design's own premise was wrong** -
which is more useful to the next reader than a tidy table. **What the implementation does instead**:

- `manifest.spec.ts` matches the platform read **by its own shape** -
  `Reflect.get(globalThis, "chrome")` - and the member **as a string literal**, in the same
  comment-stripped module. **A module that reads the platform and contains the name.**
- Every `chrome.<name>` occurrence in shipped source is **inside a comment** - 14 in
  `extension-platform.ts`, 9 in `storage.ts` - which is why D4's stripping is load-bearing rather
  than tidy: an unstripped scan would justify `storage`, `notifications` *and* `tabs` from prose,
  and `tabs` is a permission this extension deliberately does not declare.

**The looseness is in the direction that finds a justification rather than losing one**, so an
incidental `"alarms"` string in the platform module would corroborate a stale entry. That is stated
in the helper's own block rather than left for a reader to work out from the direction of the error.

### D13 - The map is the assertion, and a shipped read is deliberately not a fallback

`spectre-storage`-style bookkeeping is the easy failure here: "the permission has a read behind it,
the entry is redundant". **`tabs` is the standing proof that this would have been wrong, and the proof
comes from shipped code rather than from this file's reasoning.** `extension-platform.ts` reads
`readPlatform()`'s `"tabs"` member twice while `tabs` is **deliberately undeclared** - `tab.url` is
withheld without it, which is why the panel asks the page's content script instead (§4.6). **A case
built as "a read justifies a permission" would have failed on `tabs` first, and the repair would have
been to declare it** - the exact opposite of what the M12 review is for.

**So the asymmetry is deliberate and it decides what the case can fail on.** A permission declared
with no entry **fails**. An entry for a permission the manifest no longer declares **does not**,
because the loop is over `manifest.permissions` and never over the map's keys: **a repaired removal
must be able to leave its own bookkeeping behind without a reader deciding whether the entry is still
true.** Arm 6 of the falsification is that control, and it stayed green.

### D14 - The falsification instrument was wrong twice, and the second defect is the one this repository has recorded before

Six arms caught by the assertion each was aimed at, one control correctly unaffected, one positive
control green, `wrongcatch` / `green` / `noop` / `nocompile` / `harness-error` all zero, restoration
SHA-256 against a digest taken **before** each mutation.

- **The harness rebuilt `dist/` from the mutated source and restored afterwards**, so the built
  manifest carried one arm's planted permission into the next arm - and **the control, which must
  stay green, failed.** The repair is the **order** (restore, then rebuild) plus a line printing the
  built manifest's `permissions` before every case arm. **This is the recorded "restoring a source
  file is not restoring what the browser serves" defect, committed by the instrument that exists to
  catch it.**
- **The same defect then falsified the positive control in the next process**, because the harness's
  last arm left a mutated `dist/` behind: an unmutated run began red. **A control that fails is not a
  weak assertion - it is the instrument reporting its own state, and the state was wrong.** The
  harness now rebuilds from restored source before it reads anything at all.

**And one probe run is recorded as lost rather than reconciled away**: a baseline run failed to dock
the panel and reported it correctly (`HARNESS-ERROR`, exit `1`), and the log file was **overwritten by
the re-run** - which is the one respect in which task 2.4's retention was not met, and the failure
line is transcribed into `docs/PROVIDERS.md` §4.6 in its place rather than presented as the log.
