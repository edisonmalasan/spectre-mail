# Load-independent results — design

## D1 A wait and an assertion are two jobs, and this defect is the two doing one job

**The defect is not a timeout. It is one query doing two jobs at once.**

**The wait's job is to establish a precondition** — *the address section is on screen*. **The
assertion's job is to measure a property** — *the heading names the provider that served the
mailbox*. **The old form asked one query to do both**, and paid for it twice: the query had to
find the section by its accessible name, and the accessible name is the expensive computation.

**⇒ So the repair gives the two jobs their own instruments.** The wait watches the section's own
cheap handle; the assertion then asks the accessible-name question once, synchronously, with no
budget to expire.

**⇒ And this is the shape the repository has already applied twice on this very file** — the ninth
recorded *precondition* defect was repaired by *"waiting on the panel's own output rather than on
the recorder"*, and the repair's own reasoning was that *"a visible signal and the work behind it
are not the same moment"*. **This is the same defect wearing a different hat: here the signal and
the assertion are the same moment, and the moment is expensive.**

## D2 The budget is not raised, and that is the point

**The obvious repair is to raise Testing Library's `1000 ms`.** **It is the repository's recorded
defect with a larger number**: *"a hand-picked constant is the recorded defect with a larger
number"*, and the file's own history is explicit — *"the repair was to import the ceiling from
`packages/mailbox/src/cadence` rather than pick a number big enough"*.

**⇒ And here there is no ceiling to import, because there is no ceiling that is right.** The
observable cost of the query is **170–430 ms on this machine under this load, and it is not a
constant** — it moves with the machine. **Any fixed budget either fails on a slow machine or
wastes time on a fast one**, and the number that is "big enough" today is the number that is "too
small" next year.

**⇒ So the repair removes the budget from the path instead of enlarging it.** After it, the only
thing inside a budget is a **cheap** wait — measured at **42–108 ms** — and the expensive query
runs **once, synchronously, unbudgeted**. **The budget is no longer the thing that has to fit.**

**⇒ And the record says the measurement rather than the conclusion, because the conclusion is
machine-specific and the measurement is not:** *the query's cost is no longer inside a budget* is
a property of the test; *the query costs 170 ms* is a property of this machine.

## D3 What makes a handle cheap, and why both surfaces already have one

**A handle is cheap when finding it does not compute an accessible name.** A `data-testid` and a
text node are both cheap; a role plus a name is not, because the name has to be computed.

**⇒ The panel already had the cheap handle.** `apps/extension/src/Panel.tsx:829` renders

```tsx
<section aria-labelledby="panel-address-heading" data-testid="panel-address">
```

**⇒ And the popup already had one too**, though not as a testid: `apps/extension/src/Popup.tsx:337`
renders the address in `<p className="popup__address">`, **in the same section as the heading** —
so waiting for the address waits for the very section whose heading the assertion names.

**⇒ Neither repair touches a shipped file.** That is a consequence of the surfaces already
carrying cheap handles, and it is worth stating because the alternative — *adding a testid to the
popup* — would have been a product edit made to serve a test, and the repository's rule is that
**the product does not grow a hook for a test that has not earned it**.

## D4 The requirement's shape, and why it is a `MODIFIED`

**The capability is `build-and-verification`, and the requirement is **"A passing test run asserts
something"** — which already carries the red half of this property:**

> **a failure that appears and disappears without the tree changing SHALL NOT be reported as a
> result**, because a red that means only that the machine was busy is worse than no red at all

**⇒ The amendment adds the green half, in the same terms and for the same reason**, because **a
green that means only that the machine was idle is a claim about nothing** — and a suite whose
green is luck is a suite nobody can require to keep passing, which is the whole subject of the
requirement.

**⇒ It is a `MODIFIED` and not an `ADDED` sibling**, because the requirement already carries the
property and **two requirements about one subject is the shape this repository has recorded as a
second spelling of a set.** And a `MODIFIED` **carries every one of its scenarios forward**, so
the four existing ones come with it and one is added.

## D5 What this change deliberately does not do

- **It does not repair every site that uses the same shape.** The measurement named two. Other
  `findByRole(..., { name })` waits exist in this repository's suites, **and a red that never named
  them is not evidence that they are sound** — so the change **states the limit** rather than
  claiming the suite is free of load-dependence. **The requirement says a result must not depend
  on the machine, and a site that does is a failure of the requirement** — which is the honest
  position: the requirement is the commitment, and this change discharges the two sites the
  measurement named.
- **It does not add an abstraction.** Two call sites do not justify a shared helper, and the
  repository's rule is to avoid speculative abstractions the active task does not need.
- **It does not change a shipped file.** Not one line of `apps/extension/src/Panel.tsx` or
  `Popup.tsx` moves.
- **It does not touch the product's behaviour, and it does not change what the panel or the popup
  says to anybody.**
