# Beta

M13's beta goals, and what this product does and does not do about each of them.

## What this document is

**A record of which of the roadmap's seven beta goals are collected, how, and which are not — and
why.** The roadmap asks for them and adds one instruction that decides their shape: _"Do not optimize
around vanity metrics yet."_ **A goal that cannot be measured is a goal that must be recorded as
unmeasured, not satisfied by a number chosen to fill it.**

The measurements themselves are **on the device, in the session that produced them**. Each client
shows a person what their own session did — the website in the product region, the extension in the
side panel — and **nothing about it is persisted and nothing about it is sent anywhere**. See
[What the diagnostic is](#what-the-diagnostic-is) below.

## The seven goals

| goal                           | collected? | how                                                                                                                                                                                                     |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mailbox creation success       | **yes**    | a count of the addresses this session created, and the provider's normalized code for each failure                                                                                                      |
| mail arrival reliability       | **yes**    | a count of the listings this session received, a count of the checks it could not complete, and **how long the first message took to arrive**                                                           |
| OTP detection accuracy         | **no**     | — see [Why two of them are not collected](#why-two-of-them-are-not-collected)                                                                                                                           |
| provider failure rates         | **yes**    | a count per normalized provider code: `PROVIDER_UNAVAILABLE`, `RATE_LIMITED`, `MAILBOX_EXPIRED`, `AUTH_FAILED`, `NETWORK_ERROR`, `MESSAGE_NOT_FOUND`, `UNSUPPORTED_OPERATION`, `UNKNOWN_PROVIDER_ERROR` |
| extension compatibility issues | **no**     | — see [Why two of them are not collected](#why-two-of-them-are-not-collected)                                                                                                                           |
| email-field injection failures | **yes**    | a count per in-page answer: a field was filled, no field was found, the field already held text, the frame was not the top one                                                                          |
| site-specific UI conflicts     | **no**     | — see [What is not collected, and why](#what-is-not-collected-and-why)                                                                                                                                  |

## What the diagnostic is

**A report of what this session did, shown to the person using it, and held in memory for as long as
the session is open.**

It holds **two shapes and no others**: a **count** and a **normalized outcome**. The shapes are
declared in `@spectre-mail/ui` and both clients read the same definition, so they cannot drift. The
**labels** are each client's own, because a report reads in the voice of the surface saying it.

**What it may not hold, by name:** an address, a message id, a sender, a subject, a hostname, a URL,
a form, a field, or content. **The list is exported and a test holds it to exactly those nine
names**, because a list of prohibitions is a list somebody has to extend one incident at a time.

**There were three shapes once, and the third was an elapsed duration. It is gone**, and the reason
is the website's own rule: **the page forbids any interval of the product's own** -- its own test
says so, _"any figure here would be an invention presented as a measurement"_ -- **and the panel had
never shown one either**, so **a report would have been the first place the product showed a figure
of its own**, and a shape with no consumer is a schema to migrate rather than a feature. **Mail
arrival reliability is reported as counts**, which is what the goal asks for.

**A provider's normalized code is the fact; the response that carried it is not.** The report carries
the code and never the answer that produced it.

**And the report's own sentence avoids the word _gone_.** The page forbids that word in the state
where a provider merely failed to answer, because a word that reads as _gone_ tells a person
something false about the only copy of their address -- **and a test cannot tell whose _gone_ it
is.**

## What is not collected, and why

**Nothing is persisted, and that is a design rather than an omission.** The measurements are
per-session: did mailbox creation succeed, did a message arrive and how long after, which provider
code failed, was the email field filled and why not. **None of that needs to outlive the tab.** So
there is no third persisted area, no new record kind, no adapter, no store, and no migration — and
`docs/PRIVACY.md`'s claim that **nothing is persisted outside the two areas it names** stays true
because the diagnostic never reaches a store at all.

**A measurement that does not outlive the session it happened in does not need a place to be stored.**

**The extension's own stored records are unaffected** — a mailbox, a site association and a
seen-message id are records the product keeps for the product's own reasons, and a report is not one
of them.

## Why two of them are not collected

### OTP detection accuracy

**It needs ground truth, and this repository has never received verification mail from any
service.** The corpus in `packages/mail-parser` is **authored** — every fixture carries
`synthetic: true`, and the two named after services carry an explicit statement that no mail from
that service was received.

**A detection's accuracy measured against a corpus the repository wrote itself is a measurement of
the corpus.** Reporting it as _OTP detection accuracy_ would be the most flattering available
misstatement, and this repository does not make it.

**What would make it measurable** is real verification mail, and that arrives by a person using the
product — not by a test.

### Extension compatibility issues

**It is a report, not a metric.** Counting them would need a channel to receive them, and a channel
is a server, an account or an address — **all three of which this product does not have**, and all
three of which `docs/PRIVACY.md` says it does not have.

**The honest answer is that this goal is met by a person reporting a problem**, and that the
product's contribution to it is to be _usable enough to report on_.

## What is not collected, and why — the one that is partly measurable

**Site-specific UI conflicts are partly collectable, and the part is worth naming.**

The in-page control lives in a **shadow root**, and a shadow root is exactly what lets a page's
stylesheet reach a control. So the control can tell that it is **not visible** — that is a
measurement of the conflict.

**It cannot say whose it was.** The page's stylesheet is the page's business, and a diagnostic that
named a selector would be holding a piece of the page. **A measurement and a fingerprint are
different things, and this one is a measurement.**

**It is not collected by this release, and the reason is a channel rather than a difficulty.** The
content script is the only party that can see its own control, and the extension has no existing
message kind that asks it about anything but the host it is beside or a field to fill. **Adding one
is a protocol change, and a protocol change is a different change from this one.**

## What this document does not establish

- **No number about a real user.** This is a _shape_, and a shape is not a measurement. The goals are
  met by people using it.
- **Nothing about detection accuracy**, and nothing about how often a provider fails in the wild.
- **Nothing about how often a conflict happens**, because nothing collects it.
- **No rendering judgement.** Whether a report _reads_ well is a human's call, and no test in this
  repository reads a rendered pixel.
- **The diagnostic is not a substitute for a beta's own evidence.** It records what one session did;
  it cannot record what a _user_ concluded, and "extension compatibility issues" is the goal that
  most clearly needs the second thing.
