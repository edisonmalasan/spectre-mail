# Beta diagnostics

## Why

**M13's two release lists are complete.** `mailbox-history` shipped the last unshipped item, so what
M13 still owes is its **Beta goals** — seven metrics to collect:

```text
mailbox creation success
mail arrival reliability
OTP detection accuracy
provider failure rates
extension compatibility issues
email-field injection failures
site-specific UI conflicts
```

**And the roadmap adds one instruction that decides the shape of all seven: *"Do not optimize around
vanity metrics yet."*** The metrics exist to be acted on, not displayed.

**Measured, four of the seven are already observable from what the product knows, and two are not
observable at all:**

| roadmap metric | what the product already knows | collectable? |
| --- | --- | --- |
| mailbox creation success | `session.open()` reaches `ready`, or `failed` with one of the eight normalized codes | **yes** |
| mail arrival reliability | `InboxState` reaches `checked` with a listing, or `checkFailed` | **yes** |
| provider failure rates | the same eight codes: `PROVIDER_UNAVAILABLE`, `RATE_LIMITED`, `MAILBOX_EXPIRED`, `AUTH_FAILED`, `NETWORK_ERROR`, `MESSAGE_NOT_FOUND`, `UNSUPPORTED_OPERATION`, `UNKNOWN_PROVIDER_ERROR` | **yes** |
| email-field injection failures | the in-page recogniser's own answers: `noField`, `fieldHoldsText`, `notTopFrame`, `filled`, `notActedOn` | **yes** |
| site-specific UI conflicts | the shadow root's own control can report that it is not visible | **partly** |
| **OTP detection accuracy** | **needs ground truth. This repository has never received verification mail from any service; the corpus is authored and says so.** | **no** |
| **extension compatibility issues** | **a bug report, not a metric** | **no** |

**So the slice has three parts and only one of them is a feature**: the four observable metrics, the
one partly observable one, and **two that are recorded as uncollectable with the reason**, in the
*"What it does not establish"* shape this repository already uses in `docs/BRANDING.md` §7 and
`docs/PROVIDERS.md` §3.

## The collision that makes this a change and not a task

**`docs/PRIVACY.md`'s *does not collect* list ends with a claim that a measurement record would
falsify:**

> *"No persisted state anywhere outside the two areas named in sections 1 and 2."*

**And the claim's pointer resolves to a requirement that does not say what the claim needs it to
say.** The pointer is `spectre-storage`'s *"Persistence is reached through one contract"*, and that
requirement says a client reaches persisted state *"only through the storage layer's contracts"* —
**plural**, and its own amendment added a second and a third record kind as their own contracts.

**So the requirement permits a new record kind and the document's claim forbids a new area, and the
grounding check cannot see the difference** — it proves the pointer *resolves*, and the requirement's
own note says *"Grounding is not completeness."* **The problem here is not completeness but support**,
and that is a gap in the check the repository has not found before.

**And the resolution the design reaches is the one that makes the check unnecessary.** The four
observable metrics are **per-session**: did creation succeed, did a message arrive and how long after,
which provider code failed, was the field filled and why not. **None of them needs to outlive the
tab.** So the product can show a person their own session's outcomes, **persist nothing**, transmit
nothing, and **the privacy claim stays true as written** — and no amendment is needed to keep it
true.

## What Changes

- **ADDED** `website-client` — the page reports **this session's** outcomes to the person, counts
  only, and **persists none of them**.
- **ADDED** `extension-client` — the extension reports its own, on the same terms, including the
  in-page answers it already has.
- **ADDED** `privacy-disclosure` — **a diagnostic that persists nothing is not a record kind**, and
  the document says so **with the check that proves it**, because a claim nobody can check is the
  shape this repository exists to end.

**Three `ADDED` requirements and no `MODIFIED` or `REMOVED`, so the promoted requirement count moves
by exactly three.** That is the seventh milestone to reach that shape.

## What ships

| file | role |
| --- | --- |
| `docs/BETA.md` | the seven goals, which are collected, which are not, and **why** — in the *"What it does not establish"* shape the repository already uses |
| `apps/web/src/`, `apps/extension/src/` | the diagnostic: counts, no content, no persistence, no transmission |
| `tests/architecture/` | the check that **nothing the diagnostic holds is persisted**, which is the claim the privacy document rests on |

## What this change deliberately does not do

- **It does not persist a measurement.** No third area, no new record kind, no adapter, no store.
- **It does not transmit anything.** The product has no server and this change does not give it one.
- **It does not report a metric it cannot measure.** The two uncollectable goals are recorded as
  uncollectable, with the reason, and **no number is invented for either**.
- **It does not answer "mail arrival reliability" with a number the provider never gave.** A message
  that has not arrived yet is not a failure, and a diagnostic that counted it as one would be
  measuring the wrong thing.