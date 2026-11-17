# Design

## The defect, in one sentence

`sessionIsLive` decided liveness by reading a field the listing call never sends, so
every live Guerrilla mailbox was reported `MAILBOX_EXPIRED` — measured in the user's
own Chrome on 2026-11-18, where a freshly created address was shown as *"gone"*.

## D1 — Liveness is decided by signals the provider is measured to send

Measured on 2026-11-18 from a real browser, four bodies, all `HTTP 200`:

```text
get_email_address   {"email_addr":"…@guerrillamailblock.com","email_timestamp":…,
                     "alias":"…","sid_token":"…"}

check_email (1 msg) {"list":[{"mail_from":"no-reply@guerrillamail.com",…}],
                     "count":"0","email":"…@guerrillamailblock.com","alias":"…",
                     "ts":…,"sid_token":"…","stats":{…},
                     "auth":{"success":true,"error_codes":[]}}

check_email (empty) {"list":[],"email":"…@guerrillamailblock.com","alias":"…",
                     "ts":…,"sid_token":"…","count":0,"users":1,"stats":{…},
                     "auth":{"success":true,"error_codes":[]}}

check_email (dead)  {"auth":{"success":true,"error_codes":[]},
                     "error":"Please call get_email_address or set_email_user first",
                     "stats":{…}}
```

The three signals the adapter now uses:

| signal | live | dead |
| --- | --- | --- |
| a top-level `error` string | absent | present |
| `list` is an array | yes | **absent entirely** |
| an echoed address, when present | equals the mailbox | absent |

**Rejected: `auth.success`.** It is `true` in every body above, including the dead one.
`docs/PROVIDERS.md` §4.5 records this and says so explicitly; the shipped code's own
comment already knew the `error` key was the clearest signal and then went on to
require a field that never arrives.

**Rejected: `count`.** Measured as the **string** `"0"` on a listing holding one
message and as the **number** `0` on a listing holding none. It does not even agree
with `list.length`, so it cannot decide anything. This is recorded because it is the
kind of field that looks like a liveness signal and is not one.

**Rejected: the `sid_token` echo.** The dead body echoes no token, so a "token echoed
means alive" rule would work today. It is not used, because nothing measured
establishes the converse — a provider may echo a token it no longer honours — and a
rule whose only evidence is one direction is the defect this change exists to repair.

## D2 — Absence is not evidence, and that inversion is the whole bug

The old final branch was:

```ts
// No address at all alongside a token means the provider did not recognise the
// session. A dead session still echoes a token back.
return false;
```

That comment is false in both clauses: the dead body echoes **no** token, and the
live listing carries no `email_addr`. The code read *"the field I expected is not
here"* as *"the session is dead"* — the repository's most-recorded shape, a reader
that matches nothing reporting the absence of the thing it looked for. The repair
makes absence mean **nothing**: only a present, disagreeing address is evidence.

## D3 — `email` on the listing, `email_addr` on creation

The creation call returns `email_addr`; the listing returns `email`. The adapter's
`createMailbox` already reads `email_addr` correctly (`guerrilla.ts:289`), which is
why creation worked and listing did not. Both spellings are Guerrilla wire format and
neither enters the normalized model; `conformance.ts`'s `WIRE_FIELD_NAMES` already
lists both, and is unchanged.

## D4 — The fixtures were the reason no gate caught this

Both fixtures were labelled `MEASURED` and both contradicted `docs/PROVIDERS.md`:

| fixture | claimed | recorded |
| --- | --- | --- |
| `guerrillaLiveList` | "the session's own address echoed back" | echoed under `email`, never `email_addr` |
| `guerrillaDeadSession` | "an empty list, no `error`" | no `list` at all, and an `error` string |

The unit case for a genuinely empty inbox **hand-built** `email_addr`, so it agreed
with the code rather than with the provider. `fixtures.test.ts` requires every fixture
to *begin* with `MEASURED` or `SYNTHETIC`; it cannot check that the label is true, and
here it was not. That limit is unchanged by this change and is named in D9 rather than
papered over.

## D5 — The new recording is a captured body, not a construction

`guerrillaEmptyLiveList` is the body captured on 2026-11-18 after deleting the
provider's welcome message, transcribed with the address and tokens normalised to
`GUERRILLA_ADDRESS` / `GUERRILLA_SESSION` — the file's existing convention, which
`guerrillaSessionCreated` already follows. The envelope is otherwise verbatim,
including `count: 0` as a number and the `users` and `stats` keys, because a
recording that drops the fields it does not need stops being a recording.

**The address must stay normalised**, and that is load-bearing rather than tidy:
`apps/web/e2e/mailbox-history.spec.ts` stages an expired mailbox by planting
`planted-unreachable@sharklasers.com` and relying on the recording echoing a
*different* address. A verbatim capture would make the two agree and the arm would
stop testing disagreement.

## D6 — What changed in the requirement block, and what did not

The property is kept word for word in substance: a dead session is never an empty
inbox. What changed:

- the body gains the normative inversion — absence of a field is not evidence of
  death unless that absence is itself measured to mean it;
- the expired scenario's GIVEN says *an `error` string and no message list* where it
  said *an empty message list*, because the measured dead body carries no `list`;
- two scenarios are added: a live listing with no address (the defect arm) and a
  listing echoing a different address (the arm `mailbox-history.spec.ts` relies on);
- the measured-basis note names the signals, the two rejected fields and the date.

Both pre-existing scenarios are carried forward by title and body, which is what a
`MODIFIED` block must do or the archive refuses it.

## D7 — `docs/PROVIDERS.md` §3 gets a dated correction, and the original line stays

§3 records the M0 spike's summary as *"HTTP 200, no auth error, empty inbox"*. That
line is why the adapter was written to distrust an empty list, and it is also the
sentence that taught the shape that caused this. It is **not** deleted: it is the
record of what the spike reported, and rewriting a measurement to agree with a later
one is the defect this repository has recorded against its own instruments.

Instead a dated correction is appended under it: the bodies in §4.5 and the
2026-11-18 re-measurement show a top-level `error` and no `list`, and *"no auth error"*
is true only in the narrow sense that `auth.success` is `true` in both shapes. §4.5
itself is untouched — it already records the correct shapes and names the usable
signals, which is why the code's divergence from it is a defect rather than a gap.

## D8 — The repaired fixture reaches both browser tiers, and the expired arm survives

`apps/web/e2e/recorded-provider.ts:74` and `apps/extension/e2e/recorded-provider.ts:164`
serve `guerrillaLiveList` verbatim. So repairing the fixture is not a unit-tier
convenience: with the old code still in place it reproduces the defect in the website
tier, which is the tier that observed it live. The pre-fix red is recorded in
`tasks.md` and re-established as falsification arm A1 — the same measurement taken at
two moments, deliberately, so the claim is not only a memory of a run.

The expired arm in `mailbox-history.spec.ts` needs no stub and no edit: the planted
mailbox's address differs from the one the recording echoes, so disagreement remains
the signal under the new rule exactly as under the old one.

## D9 — What this does not establish

- **Whether the provider changed shape or the fixture was mis-transcribed in M0.**
  The spike stored summaries, not raw bodies; both `email_addr` hits in
  `tests/provider-spike/.runs/` are creation responses. The repository cannot say
  which, and this change does not guess.
- **That the extension's Guerrilla fallback failed live.** It uses the same adapter,
  so the reasoning is from shared code. No live extension run was made — the popup
  and panel require the user to load `apps/extension/dist` unpacked, which this
  change does not automate.
- **That `fixtures.test.ts` can tell a true label from a false one.** It checks that a
  label is present and first. Nothing in this repository checks that a recording
  matches the provider, and a green suite is not that check.
- **Anything about a dead session that also carries an empty `list`.** Not measured.
  The adapter would report it expired on the `error` signal; whether the provider can
  produce that body is unknown.
- **How any of it looks.** No test reads a rendered pixel; the live observation that
  started this was a person's screenshot and a page's text, and the fix is verified by
  behaviour, not appearance.

## D10 — Shipped prose that repeated the false shape

Three statements in shipped source assert the shape the measurement refutes and are
corrected with the code, because a false comment beside a repaired guard is how the
next reader reintroduces the defect:

- `guerrilla.ts:14–17` — *"answers `HTTP 200` with an empty list and no auth error"*;
- `guerrilla.ts:214–216` — *"returns `HTTP 200` with an empty list and no error"* and
  *"the only signal available is whether the response still names the mailbox's own
  address"*;
- `guerrilla.test.ts:137–141` — *"carries no `error`"*.

## Falsification arms

Each arm is aimed at one assertion; `wrongcatch`, `green`, `noop` and `harness-error`
are counted separately, and every mutated file is restored byte-identically against a
SHA-256 taken before the first mutation.

| arm | mutation | intended catcher |
| --- | --- | --- |
| A1 | restore the `email_addr` requirement in `sessionIsLive` | the empty-live unit case, and the website tier's listing case |
| A2 | `sessionIsLive` returns `true` unconditionally | the dead-session unit case and the conformance dead-session case |
| A3 | key on `auth.success` instead of the measured signals | the dead-session unit case and the conformance case |
| A4 | drop the address-disagreement branch | the different-address unit case |
| A5 | treat any non-array `list` as live | the dead-session unit case and the conformance case |
| A6 | return `[]` when `list` is absent instead of reporting expiry | the dead-session unit case and the conformance case |
| A7 | remove the `MEASURED` first word from the new fixture's docblock | `fixtures.test.ts`'s provenance case |

**A8 is recorded and not counted.** Reverting the repaired envelope to `email_addr`
and dropping `email` leaves every case green, and that is the designed result: the new
rule ignores `email_addr` and treats an absent address as live, so the fixture's
`email` key is load-bearing for the address-disagreement arm and for faithfulness, not
for the code path. **A survivor means the assertion did not catch this, never that the
assertion is too weak, until the mutant has been read and shown to be the thing it
claims.**
