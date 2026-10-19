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
