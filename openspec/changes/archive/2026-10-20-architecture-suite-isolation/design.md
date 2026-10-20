# Architecture suite isolation — design

## D1 The corpus is shared, and that is the whole defect

**Two suites read the same tree, and one of them writes to it.**

| suite | what it does with the shipped tree |
| --- | --- |
| `tests/architecture/boundaries.test.ts` | **stages probe files into `apps/` and `packages/`**, runs the real rule over them, and deletes them |
| `tests/architecture/branding-audit.test.ts` | **walks `apps/` and `packages/`** to check the public name reaches every surface |
| `tests/architecture/privacy-disclosure.test.ts` | reads the shipped tree |
| `tests/architecture/security-audit.test.ts` | reads the shipped tree |
| `tests/architecture/provider-terms.test.ts` | reads the shipped tree |
| `tests/architecture/beta-diagnostics.test.ts` | reads the shipped tree |

**And `vitest.config.ts` sets no `fileParallelism`**, so vitest's default — one file per worker, many
workers — applies, and `boundaries.test.ts` and `branding-audit.test.ts` are in different workers at
the same time.

**So the corpus of one suite is mutated by another.** That is the finding, and everything else in
this design is a consequence of it.

### Why this is not "two suites that both read the tree"

**Reading is not the problem; writing into what is being read is.** Four of the six architecture
suites read the tree and never write to it, and they have never produced a failure of this shape.
**The one that writes is the one whose reader fails** — and the reader that has the explicit repair
for it is the one that walks the whole tree.

## D2 The repair that exists, and the three ways it is incomplete

**`branding-audit.test.ts` skips probe-shaped files before the filesystem is touched**, which is the
right shape: a name test needs no file access and so cannot race a deletion.

**It is incomplete in three independent ways, and each one is a way the same class of gap can
recur.**

| gap | shape | example |
| --- | --- | --- |
| **case** | the pattern's `probe` is lowercase | `__BoundaryProbe.tsx` is not skipped |
| **extension** | `[cm]?tsx?` names no stylesheet | `__boundary-probe.css` is not skipped |
| **naming** | the name need not contain `probe` at all | `__exempt.spec.ts`, `__exempt.test.ts` are not skipped |

**And the pattern is spelled twice** — once as a `const`, once as a string literal elsewhere in the
same file. **A second spelling of a set is the defect this repository has recorded before**, and a
pattern that is spelled twice is a pattern that will be fixed in one place.

**The repair is not to widen the pattern.** A wider pattern is a guess about the shapes a future
probe might take, and the repository's own record is that **a rule per probe is a rule that is easy
to forget**:

> *"Adding a name here is the whole of opting a new probe out. That is why it is a list and not two
> separate rules: a rule per probe is a rule that is easy to forget, and a probe nobody adds to this
> file is a probe whose cost nobody has reasoned about."*

**The repair is for the vocabulary to be the source of both the name and the skip.**

## D3 One vocabulary, spelled once, and the writer names from it

**Every probe file name is a member of one list**, and:

- the **writing** side takes its file's name from that list, so a probe cannot be staged under a name
  the list does not carry;
- the **reading** side skips every file whose name is in that list, so a probe cannot be read.

**The two sides then cannot disagree, because they consult the same thing** — and that is the whole
repair. **A shape-based pattern is a guess; a shared list is a fact.**

**And the list is shared across the architecture suites, which is not the same as sharing a reader.**
The repository's rule is that *"none is shared with another architecture suite"* — and that is about
**readers**: each suite's readers are its own and are self-tested. **A shared list of staged file
names is a vocabulary, not a reader**, and the repository already has the precedent in
`QUARANTINED_PROBES`, which is a list of names in one file that other things consult.

**The list lives in one place the three parties can reach.** The three parties are: the suite that
stages, the suite that reads, and the check that says the list is complete. **A list in a file that
one of them imports is a list they cannot disagree about**, and a list spelled in three places is a
list they will.

## D4 The control's own probe, and the trap this design walks into

**The control must prove the rule catches a violation, and it proves it by staging a violation.**
**So the control stages a probe the rule is expected to find** — which is the opposite of what the
reading side does with every other probe.

**And this repository has already recorded the trap by name:**

> *"A control that calls the scan **function** is not a control on the **rule**."*

**A control that bypasses the exclusion proves the function catches the thing, and proves nothing
about the rule as it is applied.** So the control cannot simply ask for the unfiltered scan.

**The design's answer: the exclusion is applied by the rule, and the control asks the rule to exclude
every probe *except the one it staged*.** The exception is **the same name the writer took from the
list**, so the control and the rule agree about which file is the subject, and the control still
goes *through* the rule's own path.

**And this is the one place where the "one list" earns its keep**: if the control's exception were a
hand-written name, the control would be testing a file the list does not know about, and the list's
completeness check would not cover it. **The exception is a member of the list, and the list's
completeness check is what says so.**

## D5 The completeness check, and why it is the falsifiable part

**The property this change ships is: *every probe the suites stage is in the list, and every file in
the list is skipped by every reader that walks the tree.***

**A check that says the list is complete is a check that the list's entries and the suites' staged
names agree.** And that check can be made to fail — **which is what makes the change falsifiable**:
if a suite stages a probe under a name the list does not carry, the check reports it.

**The check is not a scan for the word "probe"**, because a scan is the defect being repaired. **It
compares the set of names the suites stage against the list** — and the set of names the suites
stage is itself read from the **call sites that stage them**, not from a pattern.

## D6 The time budget is one shared decision

**`boundaries.test.ts` raised its own per-test budget to 60 s on 2026-10-03, and its comment says
why:**

> *"a rule that writes a probe file and then re-walks the whole of `apps/` or `packages/mailbox/` …
> A test that fails for no reason is worse here than a test that fails for the right one … a timeout
> means only that the machine was busy."*

**`branding-audit.test.ts` never raised one, and its 5000 ms timeout is the one failure in the
measured list that is about the machine rather than about a race.**

**So the budget is a property of "this suite writes and re-walks the tree", not of one file's
private decision.** The repair: **the suites that stage probes and re-walk the tree carry the
budget, and the budget is one shared constant rather than one file's copy of it** — because a
constant that lives in one file and is copied into another is a second spelling of a set.

## D7 The correction to the merged record is part of the work

**The merged record says *"`pnpm test` is a coin flip on `main` itself"* and cites the pristine-`main`
measurement as if it were reproducible.** **It is not** — the idle-machine measurements are green —
and the record does not carry them.

**So the record is corrected, and the correction narrows the claim to what the measurements support:**

- the red is **real** — named cases, real errors, a different set per run;
- it is a **function of timing rather than of the tree**;
- and **a red that appears and disappears without the tree changing is a red that means nothing**,
  which is the failure mode the requirement already forbids.

**The correction is written into the ledgers with its own measurement, because a correction is not
evidence either** — and this repository has recorded exactly that, about a different correction.

## D8 What this change deliberately does not do

- **It does not make the corpus private per suite.** A disposable copy of the tree per suite is the
  larger repair, and the repository already has the pattern for it. **It is not taken here because
  it would parameterise every scan's roots, and this repository has recorded why scan functions take
  no argument:**

  > *"each scan function takes **no** argument — an argument would be a second spelling of which
  > apps to scan."*

  **So the smaller repair is the one the repository's own constraints point at, and the larger one is
  recorded as the question this change does not settle.**

- **It does not touch shipped code**, and it does not add a capability.

- **It does not claim the gate is now deterministic under every load.** The measurement is a table of
  runs, not a proof, and the record says so.
