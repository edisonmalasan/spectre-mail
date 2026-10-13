# Design

## Context

The facts this design rests on were measured while writing the proposal, not carried forward.
Re-reading the recorded finding rather than trusting it is what produced the change.

**What the manifest declares.** `apps/extension/static/manifest.json` declares
`permissions: ["storage", "alarms", "notifications", "sidePanel"]` and two `host_permissions`
(the provider origins, in the wildcard path form).

**What shipped code reaches.** Scanning every file under `apps/extension/src` for
`chrome.<permission>` and for the bare token:

| permission | a shipped `chrome.<name>` call | modules reaching it |
|---|---|---|
| `storage` | yes | ~30 files, incl. `App.tsx`, `Popup.tsx`, `Panel.tsx`, `create-mailbox.ts`, `entry.ts` |
| `alarms` | yes | `alarms.ts`, `background-check.ts`, `extension-platform.ts` |
| `notifications` | yes | `notification.ts`, `background-check.ts`, `extension-platform.ts` |
| `sidePanel` | **no** | **none** |

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
