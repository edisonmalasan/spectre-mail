# Architecture suite cleanup

## Why

**The architecture suite proves its rules by mutating the shipped tree, and the mutation is undone in a `finally` that a timeout never reaches.**

`tests/architecture/boundaries.test.ts` proves two of its rules by writing into a **tracked, shipped
file**:

| the rule | the file it mutates | the mutation |
| --- | --- | --- |
| *"keeps a remote asset out of the client's own markup"* | `apps/web/index.html` | injects a `<link href="https://fonts.example.invalid/geist.css">` |
| *"quarantines every platform probe that reaches past what the product ships"* | the repository's own `package.json` | adds a `scripts` entry naming a quarantined probe |

**Both are undone in a `finally`, and a `finally` does not run in a process that was killed.**

### The measurement, and it is the sharp end of the thing

**The suite's red under CPU contention is two of its own cases exceeding the shared 60 s budget** —
*"catches a platform store or the URL in a client"* at **61.6 s** and *"keeps the spike unreachable
from workspace code"* at **78.2 s** — **and the mutation sits on disk across the timeout**, because
the rule's own full-tree scan is the slow part and the scan is what the budget measures.

**So an interrupted run leaves the shipped tree modified.** Measured, after three runs:

```text
apps/web/index.html
-    <div id="root"></div>
+    <link src="https://fonts.example.invalid/geist.css" /><link href="https://fonts.example.invalid/geist.css" /><link src="https://fonts.example.invalid/geist.css" /><div id="root"></div>

package.json
-    "verify": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build"
+    "verify": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build",
+    "test:live-permission": "node alarms-packing.mjs"

-}
+}
\ No newline at end of file
```

**Both are tracked files, so a leftover is a modification that can be committed** — and it is not an
untracked artefact that `git status` shows as noise. **It is a change to the website's own markup and
to the repository's root manifest.**

### And the leftovers make the *next* run red

**Because the rules that were proving themselves now find the previous run's artefacts.** Measured,
by name:

| the rule | what it reports |
| --- | --- |
| *"keeps a remote origin and a removed focus indicator out of a shipped stylesheet"* | the leftover remote-origin stylesheet |
| *"keeps a remote asset out of the client's own markup"* | the leftover `<link>` |
| *"resolves a custom property read against a declaration above in the same file"* | the leftover local-token stylesheet |
| *"quarantines every platform probe that reaches past what the product ships"* | `package.json` naming a quarantined probe |

**So a run's red is about the previous run, and the previous run was green.**

### And the repository carried no remedy for it

**Not in `AGENTS.md`, not in `docs/ROADMAP.md`, and not in the change's own record.** The
`architecture-suite-isolation` record *asserted* the cause — *"the suite's own probes left in the
tree by a cancelled run"* — **without measuring it, and an asserted cause is not a measured one.** The
repository's only remedy was manual — *check `git status` before every gate run* — **and it named one
of the two mutated files.** `package.json` was not named, and it is the more serious of the two: a
stray `scripts` entry in the root manifest is a change to the repository's own build surface, and the
lost trailing newline breaks `format:check` as well.

**A manual remedy for a mechanical defect is the shape this repository criticises everywhere else**,
and here it was also *incomplete*.

## Why this is a change and not a task

**Because the repair cannot be made inside one assertion, and because the constraint it runs into is
the one `architecture-suite-isolation` recorded as unsettled.**

`architecture-suite-isolation`'s `design.md` D8 says the larger repair — **a disposable corpus per
suite** — *"would parameterise every scan's roots, and this repository has recorded why the scan
functions take no argument: **an argument would be a second spelling of which apps to scan**"* — and
**that the larger one is recorded as the question this change does not settle.**

**The measurement has now settled it.** A timeout that leaves the shipped tree modified is not a
rarity to be tolerated; it is a **tracked-file mutation that a later run reports as a violation, and
that a commit can carry.** **So the corpus must be private, and the constraint has to be answered
rather than avoided.**

**And the repair is a change to the suite's own shape**, not to a rule: the suite has **53**
assertions, sixteen of which stage a file into the tree, and two of which stage into a **shipped**
file.

## What ships

1. **The suite's own staged probes become invisible to the rules that walk the tree.** The rules
   skip every name in the shared vocabulary, **and a control asks the rule to skip every probe
   *except the one it staged*** — which is `architecture-suite-isolation`'s own `design.md` D4, **recorded
   there and not implemented there.** **So a leftover probe is harmless to the next run**, and the
   control still goes *through* the rule's own path rather than around it.

2. **The two shipped-file mutations move onto a disposable copy of the tree**, so the shipped file is
   **never written**. The corpus roots are carried in **one shared module** — the same shape as
   `staged-probes.ts` — **rather than as a parameter on every scan**, because the repository's own
   recorded reason for no parameter is that a parameter *would be a second spelling of which apps to
   scan*, and **one shared binding is not a second spelling.**

3. **A check that the tree is unchanged after the architecture suite runs** — the suite's own
   footprint on the tree is zero, **and the check is about the tree and not about the rules.**

4. **The record's remedy is replaced by the property.** The manual *check `git status` before every
   gate run* is **not a remedy**; it is a habit, and it names one of the two files. **The property
   replaces both.**

## What this does not establish

- **That the suite is deterministic under every load.** A timeout will still happen under enough
  contention. **What this changes is that a timeout is no longer destructive** — and that is a smaller
  and a different claim.
- **That the boundary suite's other staged probes are gone.** They are staged into the tree and
  removed in a `finally`; a timeout can still leave one behind. **Part 1 makes such a leftover
  harmless to the next run**, and **that is the whole of the claim** — not that it cannot happen.
- **Anything about the product.** No shipped code is touched.
