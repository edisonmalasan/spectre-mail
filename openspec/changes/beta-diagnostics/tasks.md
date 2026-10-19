# Beta diagnostics — tasks

## 1. Records

- [ ] 1.1 Record in `docs/BETA.md` the **seven** roadmap goals, each with **whether it is collected,
      how, and why** — and for the two that are not, **the reason, in the *"What it does not
      establish"* shape `docs/BRANDING.md` §7 and `docs/PROVIDERS.md` §3 already use.**
- [ ] 1.2 Record the measurement that decided the shape: **the four observable goals are
      per-session**, and a measurement that does not outlive the session it happened in does not need
      a place to be stored.
- [ ] 1.3 Record **which goals are partly collectable** and **which part** — a UI conflict is
      visible to the control and its cause is not.
- [ ] 1.4 Record that **"OTP detection accuracy" needs ground truth this repository does not have**,
      and that the corpus is authored -- so a number computed against it would be a measurement of
      the corpus.
- [ ] 1.5 Record that **"extension compatibility issues" is a report, not a metric**, and that a
      channel to receive one is a server, an account or an address -- all three of which the
      product does not have.
- [ ] 1.6 Record the **support gap** in the grounding check: the last row of the *does not collect*
      list rests on a requirement that **permits** what the claim forbids, and the check proves a
      pointer resolves rather than that the requirement says what the claim asserts.

## 2. The shape of what may be reported

- [ ] 2.1 One **shared** definition of a reportable value -- **a count, a normalized outcome, or an
      elapsed duration** -- used by both clients, so the two cannot drift.
- [ ] 2.2 The definition SHALL **exclude** an address, a message id, a sender, a subject, a hostname,
      a URL, a form, a field and content, **by name**, because a list of prohibitions is a list
      somebody extends one incident at a time.
- [ ] 2.3 **A duration is not a timestamp**, and the reason is recorded: a duration cannot be placed
      on a calendar.
- [ ] 2.4 **A provider's normalized code is the fact and the response that carried it is not.**

## 3. The website

- [ ] 3.1 The page reports the session's outcomes: creation succeeded or failed, the normalized code
      for each failure, whether a message arrived and how long it took.
- [ ] 3.2 **A message that has not arrived is not a failure**, and no arrival time is reported for
      one.
- [ ] 3.3 The diagnostic is **reachable by the person** and reads as a report of this session, not as
      a dashboard of all time.
- [ ] 3.4 **Nothing the diagnostic holds is written to any store.** The counters live in the client
      and are gone when the session ends.

## 4. The extension

- [ ] 4.1 The extension reports its own outcomes on the same terms, including the in-page
      recogniser's **own answer** for each attempt -- a field filled, no field found, the field
      already held text, the frame was not the top one -- as counts.
- [ ] 4.2 A **UI conflict is reported as a conflict and not as a cause**: the control can see that
      it is not visible, and **SHALL NOT** report which rule on the page did it.
- [ ] 4.3 The extension's **stored records are unaffected** -- a mailbox, a site association and a
      seen-message id are records the product keeps for its own reasons and are not diagnostics.

## 5. The check

- [ ] 5.1 A **new** architecture suite, **not** a new rule in `boundaries.test.ts`: the property is
      *"nothing the diagnostic holds is persisted"*, which a rule about which module may import which
      cannot see.
- [ ] 5.2 It SHALL find the diagnostic's values in the shipped tree and require that **none of them
      is written to a store** -- by looking for the write, not by looking for the absence of a
      record kind.
- [ ] 5.3 It SHALL hold `docs/PRIVACY.md`'s enumeration and the tree against each other: every
      record kind the tree persists appears in the enumeration, and every row of the enumeration
      corresponds to something the tree persists.
- [ ] 5.4 **Every reader falsified by a `--self-test` before its tally is trusted**, and a run with
      no summary reports `harness-error` rather than a count.
- [ ] 5.5 The suite self-tests for pattern-freeness and for **sharing no reader** with the four
      existing architecture suites.

## 6. Verification

- [ ] 6.1 `pnpm verify` **three** times, exit 0, `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory
      created and measured **empty immediately before and after**.
- [ ] 6.2 `pnpm test:browser` repeated with a stated denominator; a run carrying no tier summary is
      `HARNESS-ERROR`; **a red with no name is not a finding** -- capture its title or record it
      unattributed, and **do not round it away**.
- [ ] 6.3 `pnpm test` from a `--reporter=json` run **grouped by project**.
- [ ] 6.4 The browser tier gains cases for: the diagnostic appears when asked for, **carries no
      address, hostname or content**, **a message that has not arrived is not a failure**, and
      **nothing it holds survives the page**.

## 7. Falsification

- [ ] 7.1 **Pre-mutation** SHA-256 digests of every file mutated; every violation caught **by the
      assertion aimed at it**; `wrongcatch`, `green`, `noop`, `nocompile`, `harness-error` all zero.
- [ ] 7.2 Include a violation that **writes a diagnostic value into a store**, because that is the
      property the whole check exists for and the one a reader returning nothing would pass
      trivially.
- [ ] 7.3 Include a violation that **puts an address or a hostname into the diagnostic**, because
      the shape of what may be reported is a list, and a list nobody has broken is a list nobody has
      checked.
- [ ] 7.4 Include a violation that **reports a message that has not arrived as a failure**, because
      that is the mistake a diagnostic is most likely to make.
- [ ] 7.5 The instrument lives **outside the repository** and is deleted afterwards; `dist/` rebuilt
      from restored source, and a failed rebuild reported rather than exited quietly.

## 8. Predictions, so that they are falsifiable

- [ ] 8.1 **`packages/storage` is unmoved, at 103.** A diagnostic that persists nothing adds no
      adapter, no store and no key -- and **a rise would mean a record was added that the requirement
      forbids.**
- [ ] 8.2 `packages/mailbox` and `packages/providers` are **unmoved**: the session's outcomes are
      already states and the change reads them.
- [ ] 8.3 `apps/web` and `apps/extension` **rise**, and the browser tier rises with them.
- [ ] 8.4 **`tests/architecture/boundaries.test.ts` stays at 53** -- the new check is a new file, not
      a new rule in that one, because the property is *"nothing the diagnostic holds is persisted"*
      and a rule about which module may import which cannot see it.
- [ ] 8.5 **No new record kind appears in `docs/PRIVACY.md`'s sections 1 and 2**, and the *does not
      collect* list keeps its last row **unchanged** -- which is the whole point of the change.

## 9. Deliberately not done, and why

- [ ] 9.1 **No measurement is persisted.** No third area, no new record kind, no adapter, no store.
- [ ] 9.2 **Nothing is transmitted.** The product has no server and this change does not give it one.
- [ ] 9.3 **No number is reported for a goal that cannot be measured.** The two uncollectable goals
      are recorded as uncollectable, with the reason.
- [ ] 9.4 **The grounding check is not widened.** Deciding what every requirement *ought* to say is
      a research project; the claim is made true instead, and checked in the way the tree can answer.
- [ ] 9.5 **No visual judgement encoded** -- whether the diagnostic reads well is a human's call,
      and no test in this repository reads a rendered pixel.
- [ ] 9.6 **`AGENTS.md` and `docs/ROADMAP.md` are not written by this stage**, and **`docs/PRIVACY.md`
      is edited only if the new check requires it** -- and if it does, **the disclosure is this
      change's work and not a stale document**, exactly as `mailbox-history` found.