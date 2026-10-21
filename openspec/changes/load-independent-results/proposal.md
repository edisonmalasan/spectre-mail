# Load-independent results

## Why

**A clean `main` has a unit suite that is red about half the time, and the red means the machine
was busy.**

### Measured, on `main` at `74c99a8`, on 2026-10-21

**1. The suite is red in 3 of 5 full runs, and the red has a name.** The same case every time:

```text
apps/extension/src/Panel.test.tsx
  the panel renders the mailbox beside the page
  > names the mailbox this page resolves to and the provider that served it
```

**Green in 2 of 5. And green in 6 of 6 when that one file ran alone.**

**2. The cause is measured, and it is not the one the failure message suggests.** The failure says
`Unable to find role="heading" and name "guerrilla"`, which reads like *"the heading never
arrived"*. **It always arrived.** The measurement:

| what was measured | what it cost |
| --- | --- |
| the address section arriving on screen | **42–108 ms** |
| the accessible-name query for the heading, run **after** the answer was already on screen | **170–430 ms** — and it **succeeds** every time |
| the case's old form, end to end | **366 ms to 1413 ms** |

**So the heading was never late. The query was slow, and the wait's budget was spent on it.**
The case waited on Testing Library's **default 1000 ms** budget, and the two costs together cross
that budget about half the time on a loaded machine.

**⇒ The cost is not a curiosity — it is the whole defect.** `getByRole(role, { name })` computes an
accessible name for every candidate that carries the role, and this panel has six headings. The
query is the expensive half of the wait, and the wait's budget is what the expensive half has to
fit inside.

**3. The same shape is at a second site.** `apps/extension/src/Popup.test.tsx` waits on
`findByRole("heading", { name: "guerrilla" })` for the same reason — **and *a defect that shows up
at one site is evidence about the sites and not about the one.***

**4. And the repository's own requirement already forbids the red half of this.** `build-and-verification`'s
**"A passing test run asserts something"** carries a scenario that says:

> **a failure that appears and disappears without the tree changing SHALL NOT be reported as a
> result**, because a red that means only that the machine was busy is worse than no red at all

**⇒ The green half is the same defect and is not covered.** A pass that appears and disappears
without the tree changing is **not a result either**, and **a green that means only that the
machine was idle is a claim about nothing.**

## Why this is a change and not a task

**Because the property it carries is new, and a property that is not written into a promoted
requirement is not a commitment.**

**⇒ The repair itself is two files and no product change.** The panel's address section already
carries a `data-testid`, and the popup's already renders the address, so both surfaces can be
waited on by a cheap handle that already exists. **What the repair cannot express on its own is the
rule that makes it a rule** — and the repository's whole method is that a property without a
requirement behind it is a note somebody happens to have written down.

**⇒ And the requirement already has the shape this belongs in.** *"A passing test run asserts
something"* is about whether a run's outcome means anything, and a run whose green or red is a
function of the machine's load **says nothing**.

## What ships

1. **The repair**, in the two measured sites: **the wait is on the surface's own cheap handle, and
   the accessible-name query runs once, synchronously, unbudgeted.** **The budget is not raised —
   the thing that had to fit inside it no longer has to.**
2. **The requirement amendment**, on `build-and-verification`'s **"A passing test run asserts
   something"**: **a result — a pass or a failure — that depends on the machine rather than on the
   tree is not a result.**
3. **The measurement**: a table of runs before and after, and five deliberate violations with the
   restoration verified against a SHA-256 taken before each mutation.

## What this does not establish

- **That the suite is free of load-dependence.** This change repairs the two sites the measurement
  named, and **the sites that use the same shape and were not named by a red are not repaired** —
  which is a limit of the repair and is stated rather than smoothed over.
- **That a green run proves anything beyond what it measures.** The table is a table of runs, not a
  proof.
- **Anything about the machine's speed.** The measurement is of *this* machine's *this* load; the
  property it establishes is that **the query's cost is no longer inside a budget**, which is a
  property of the test and not of the hardware.
