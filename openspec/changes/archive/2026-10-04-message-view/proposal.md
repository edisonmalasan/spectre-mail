# Message view — M5 slice 3

## Why

The inbox lists mail and marks which messages carry a verification. The mark is a
claim about a message the user cannot read, which is the least satisfying thing this
product can do. Someone waiting on a signup confirmation sees "Contains a one-time
code" and then has no way to get the code.

The code was **already read and then thrown away**. `packages/mailbox/src/inbox.ts`
fetches the whole message for every new arrival to decide a one-word verdict
(`determine`, lines 233–246), runs `analyseMessage` over its body, and keeps only the
verdict. The readable text, the codes, and the links all existed in that function's
scope and were discarded. So this slice is mostly about **not throwing away what was
already read**, plus a view that renders it as text.

## What

- `packages/mailbox` gains an opened-message state: `none` / `opening` / `opened` /
  `openFailed`, held alongside the inbox on `SessionState.ready`.
- The analysis of each new message is **retained**, pruned to the current listing, so
  opening a message the session already read costs **no provider request at all**.
  A message it has not read is fetched and analysed on demand.
- `apps/web` gains a `MessageView` showing sender, subject, arrival time, the readable
  text, the detected codes in rank order, and the detected links with their destination
  hostnames. Rows become buttons so a message can be opened from the keyboard.

## What this slice deliberately does not do

| Deferred | Why |
| --- | --- |
| **Copy the code** | `AGENTS.md` assigns "OTP copy/fill" to **M10**. M5's acceptance criteria also say "copy the OTP" — see "The one conflict in the sources" below. |
| **Open a verification link** | M10 owns it as an explicit user action with a stated new-tab policy. Slice 3 shows the link and its hostname; nothing is clickable. |
| **Notifications** | M10. |
| **Fill a code into a form** | M10. |
| **Persistence** | M6. A reload still discards the mailbox. |
| **Styling** | M7. Structure only, as slice 2 was. |
| **Routing / back button in the URL** | No router exists and none is needed for one mailbox. See `design.md` D5. |

## The one conflict in the sources

`docs/ROADMAP.md`'s M5 acceptance criteria list **"copy the OTP"** as something a user
must be able to do in M5. `AGENTS.md` states that the verification workflow —
"notifications, OTP copy/fill" — is **M10**, and M10's own "User actions" block lists
`Copy code`, `Fill code`, `Open verification link`.

These conflict on one item. This change resolves it **in favour of `AGENTS.md`**, and
the reasoning is recorded in `design.md` D4 rather than left implicit:

- `AGENTS.md`'s sentence is a **correction**. The same file records an earlier draft
  that put storage at "M5–M6", naming a milestone from the layer that felt like it
  should come next rather than the one the roadmap schedules — and it was wrong. So
  where a summary and the roadmap disagree, the summary here is the considered
  statement.
- The conservative reading is the **smaller slice**, and a milestone establishes only
  what its own scope allows.
- A copy button would have to justify itself by **amending `AGENTS.md`**. Recording a
  deferral needs no amendment; absorbing scope silently is the failure mode.

M5's acceptance criteria are **not edited** by this change. The criterion stays where
the roadmap put it, and D4 names the milestone that delivers it. Amending a plan's
exit conditions from inside a slice is how a plan stops being a plan.

## Scope of the change

| Capability | Requirements added |
| --- | --- |
| `mailbox-session` | 6 |
| `website-client` | 4 |

No requirement is modified. Nothing is removed.

## Verification approach

The falsification harness and the independent verification pass follow slice 2's
pattern, and the specific traps slice 2 found are named as traps in `tasks.md`:

- a "makes no request" assertion is worthless without a **positive control that makes
  the same code path actually issue a request**;
- a comment claiming an enforcement nobody wrote is worse than no comment — the
  `fetch` rule did not follow the polling loop into `packages/mailbox` at slice 2;
- an assertion whose only coverage would pass with the behaviour removed is vacuous,
  and one comparison of two outputs of the same function can pass for a reason that has
  nothing to do with the rule it names.

Nothing in this slice has been run against a live provider or in a real browser, and
neither claim will be made.