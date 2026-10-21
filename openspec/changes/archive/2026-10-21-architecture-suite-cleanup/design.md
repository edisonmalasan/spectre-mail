# Architecture suite cleanup — design

## D1 The defect is a mutation that outlives the process that made it

**The suite writes into a shipped file and undoes it in a `finally`.** A `finally` runs when a test
ends *normally or by throwing*; **it does not run when the worker is killed for exceeding its
timeout.**

**And the timeout is not an unlucky interruption.** The rule that mutates `apps/web/index.html` then
runs `stylesheetViolations()` — **a full-tree scan** — and the scan is the slow part, so the budget
is spent on the scan, while the mutation is on disk. **The mutation and the thing that times out
are the same test.**

**So the repair cannot be a better `finally`.** A `finally` is a promise about the *normal* path,
and the defect is on the abnormal one.

## D2 Two kinds of leftover, and they need different repairs

| kind | example | what it does to the next run |
| --- | --- | --- |
| **a staged probe** | `packages/mailbox/__clock-rule-probe.ts` | the rules that walk the tree **report it as a violation** — the probe is a violation by construction |
| **a mutated shipped file** | `apps/web/index.html` with an injected `<link>` | the rule that was proving itself **finds the previous run's artefact** |

**The second kind is the worse one** — it is a *tracked file*, and it is a mutation of the website's
own markup or of the repository's root manifest.

**And the two kinds are repaired in opposite directions.** A staged probe must become **invisible** to
the rules; a mutated shipped file must become **impossible**.

## D3 A staged probe becomes invisible: the rule skips the vocabulary, the control excepts itself

**`architecture-suite-isolation` built the vocabulary — `staged-probes.ts`, 23 stems — and gave it to
the *reader*.** The *writer*'s own rules still read the tree and find the suite's own probes, because
the controls need them found.

**So the same vocabulary is needed on the writer's side, and with the exception the controls need.**

`architecture-suite-isolation`'s `design.md` D4 says it exactly:

> *"The exclusion is applied by the rule, and the control asks the rule to skip every probe **except
> the one it staged**. The exception is **the same name the writer took from the list**, so the
> control and the rule agree about which file is the subject, and the control still goes **through**
> the rule's own path."*

**And it was recorded there and not implemented there**, because the ASI change's scope was the
*reader*. **Implementing it is this change's first half**, and it is what makes a leftover probe
harmless: every rule skips every name in the vocabulary, so a probe left on disk is not a violation.

**And the control is not weakened by it.** The control's probe is excluded *only* for that one call,
by name, and the name is a member of the vocabulary — so the completeness check still covers it, and
the control still goes through the rule rather than around it. **The repository's recorded trap —
*"a control that calls the scan function is not a control on the rule"* — is avoided because the
exception is the rule's own exclusion, with one name removed, and not a different code path.**

## D4 A mutated shipped file becomes impossible: the corpus is private

**The shipped file must never be written.** So the control's mutation lands on a **copy** of the
tree, and the rule reads the copy.

**And this is the larger repair `architecture-suite-isolation` recorded as unsettled.** Its recorded
blocker:

> *"It would parameterise every scan's roots, and this repository has recorded why the scan functions
> take no argument: **an argument would be a second spelling of which apps to scan**."*

**The answer is not to avoid the constraint but to satisfy it.** The constraint is about a *second
spelling* — a list of roots written in more than one place, so that two places can disagree about
which apps are scanned. **One shared binding is not a second spelling**, and the repository already
has the precedent in the same suite: `staged-probes.ts` is a shared module that two suites consult,
and it is *data*, not a reader.

**So the roots move into one module, and every rule reads them from there.** The scan functions keep
taking **no argument** — they read the shared binding — **so the recorded constraint is honoured
literally, and the constraint's *purpose* is served, because there is exactly one list of roots.**

**And the suite that needs a private corpus sets the binding for the duration of one assertion and
restores it.** That is **mutable module state**, and the repository's rule about it says to limit it
to genuine cross-cutting concerns and **document each one** — and **the corpus is the most
genuine cross-cutting concern there is**: every rule in the suite reads it.

**And the binding is restored in a `finally`, which is the very thing that fails.** So the repair
**does not rely on the restore**: the private corpus is a **disposable copy**, so the *shipped* tree
is untouched whether or not the restore runs. **The restore is a tidiness, not the safety.**

## D5 The check that the tree is unchanged

**The property is about the tree, not about the rules**, and it is a different kind of check from
anything else in the suite — **which is why it does not belong inside a rule's own assertion.**

**It takes a fingerprint of the tree before the suite runs and compares it after.** What the
fingerprint covers is the decision:

- **every tracked file's content hash** — because the defect is a *tracked* file's content changing,
  and the two files the suite mutates are both tracked;
- **every file's presence** — because a staged probe left behind is a new file.

**And the comparison is against Git, not against a remembered value** — the repository's own rule,
from the day a hand-transcribed digest reported a file as differing that `git status` never listed
as modified.

**And the check runs outside the suite**, because a check that runs inside the thing it checks is a
check that runs after the damage. **A separate process, after the suite, comparing the tree against
`HEAD` — and reporting the paths, not a count.**

## D6 The budget, and what it is for after this change

**The two cases that timed out — 61.6 s and 78.2 s — will still time out under enough
contention.** That is not what this change fixes.

**What this change fixes is that a timeout is no longer destructive.** And that changes what the
budget is for: **it was a ceiling on a test's cost, and after this change it is also a ceiling on a
test's *blast radius*.**

**And the shared budget stays shared** — `architecture-suite-isolation` moved it to
`tests/architecture/scan-budget.ts` and both suites take it, and **that is a second spelling of a set
waiting to happen if anyone copies it back.**

## D7 The record's remedy is replaced by the property

**The repository's remedy was manual** — *check `git status` before every gate run* — **and it named
one of the two mutated files.**

**A manual remedy is not a remedy.** It is a habit, and habits are not gates. **After this change
the property is mechanical and it names both files, because it compares the whole tree.**

**And the record's asserted cause is replaced by the measured one.** The ASI record said *"the
suite's own probes left in the tree by a cancelled run"*, which is **true and incomplete** — the
probes are the *lesser* of the two, and the shipped files are the ones that can be committed.

## D8 What this change deliberately does not do

- **It does not make the suite fast.** Two cases walk the whole tree and can exceed any budget under
  enough contention.
- **It does not remove the suite's staged probes.** Sixteen assertions stage a file into the tree,
  and **that is how they prove the rules find violations.** What changes is that a leftover is
  harmless.
- **It does not touch the product.** No shipped code changes, and the website's markup and the
  repository's manifest are never written by a test again.
