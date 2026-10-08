# Tasks

Each group lands the tests and documentation its own work calls for. Nothing is deferred to a final
testing group, because a group that first exercises an earlier group's work makes the failures
cascade back through everything in between.

## 1. Record the measurements this design rests on

- [x] 1.1 Add `docs/PROVIDERS.md` §4.4 with the six measured rows (A1–A3, B, C/D, E, F), each stating what it does **not** establish, in the shape §4.2 uses. Verify the section names the probe's four arms and its positive controls rather than only its conclusion.
- [x] 1.2 Record in the same section the two defects the measuring instrument had — a service worker does not deliver `sendMessage` to its own listener, and `context.backgroundPages()` does not exist for an MV3 worker — as findings about the instrument, with what each would have made a reader conclude. Verify neither defect is described as a platform result.
- [x] 1.3 Record `extensionScheduler`'s use of `window.setTimeout` as a defect found by reading rather than measuring, since a service worker has no `window`. Verify the note says which test would not have caught it.

## 2. The extension's platform seam

- [x] 2.1 `git mv apps/extension/src/local-area.ts` to `extension-platform.ts`, keeping the storage-area read and its reasoning, and update every importer. Verify `pnpm typecheck` passes and no reference to the old path remains.
- [x] 2.2 Add a narrow messaging seam to that module: send a request, and register a removable handler. Verify neither the worker nor the content script names the platform global, by reading them rather than by inspection of the diff.
- [x] 2.3 Retarget `CHROME_PLATFORM_READER` to the new filename, keeping the rule's `chrome` identifier pattern and its negative control. Verify by planting a probe at a **fresh path** in the real tree that the rule reports it by name, and that removing the probe leaves the suite green.
- [x] 2.4 Unit tests for the seam: the platform read reports absent rather than throwing where there is none; a registered handler can be removed; the module is the only one reaching the global. Verify each fails when its subject is broken.

## 3. The request, and the answer that may not be one

- [x] 3.1 A shared module declaring the request and an answer as a discriminated union: created, refused, not stored, not acted on. Each refusal a named variant carrying the provider's own words, never a bare string. Verify both the worker and the content script can import it without either importing the other.
- [x] 3.2 Narrow the platform's untyped answer on the sending side; an unrecognised shape degrades to *no answer* rather than to a claim. Verify a reply of the right JSON type but the wrong shape is refused, and that refusing it produces no insertion.
- [x] 3.3 Unit tests for every variant and every malformed reply, including one that is valid JSON with an unknown discriminant.

## 4. The worker's answer to a creation request

- [x] 4.1 A handler that builds its own session per request, opens, and persists before it answers. Verify over a recording transport that the mailbox reaches storage through the shared storage contract and not by a direct platform write.
- [x] 4.2 Answer on every path: created, provider refusal carrying the provider's own words, a failure to persist, and an unrecognised message. Verify the persist-failure answer carries no address, so nothing downstream can treat it as one.
- [x] 4.3 Retain nothing after answering. Verify by a unit assertion on the module's own state **and** by the browser case in 7.6, since a unit assertion about a module-level variable cannot see a context that was never asked.
- [x] 4.4 Unit tests that a second request creates a mailbox independently of the first, over a recording transport with a positive control that does issue a request.
- [x] 4.5 Assert the worker still schedules no repeated request and creates no alarm, extending the existing `service-worker.test.ts` assertions rather than replacing them.

## 5. A scheduler that works where there is no `window`

- [x] 5.1 Change the extension's scheduler to resolve its timer without assuming a `window`, keeping the reason for naming the receiver explicitly. Verify the popup path still schedules and cancels through the same module.
- [x] 5.2 A unit test driving the scheduler with no `window` present. Verify it fails against the current implementation, which is the point of writing it.

## 6. The creation offer, inside somebody else's page

- [x] 6.1 The affordance gains wording for the three states it can be in — offering to create, waiting, and what it could not confirm — and reuses slice 1's styling with **no new design token and no new motion**. Verify `packages/ui` still reports 38 tests.
- [x] 6.2 The controller offers creation when this device holds no address, and the insertion offer unchanged when it holds one. Verify each by the control's own accessible name, not by the presence of a button.
- [x] 6.3 The controller holds the control while an answer is outstanding and removes it once the answer arrives, and otherwise still removes it on focus change. Verify the outstanding case removes it when the answer lands rather than persisting.
- [x] 6.4 One request per activation: a second activation while one is outstanding causes no second request. Verify by counting requests at the seam, not by counting renders.
- [x] 6.5 An answer carrying an address is inserted only if the field still holds no text. Verify the text-acquired case inserts nothing.
- [x] 6.6 On no answer within the wait, the controller re-reads this device's stored mailbox and acts on the read: a mailbox is inserted, and none is reported as unconfirmed rather than as failed. Verify both arms, and that a read which **rejects** is not treated as a read that found nothing.
- [x] 6.7 Unit tests for every state above, including the refusal wording arriving from the provider verbatim.

## 7. The browser tier, offline, against the built extension

- [x] 7.1 Extend the extension tier's routing so the worker's provider requests are fulfilled by the recorded responses and not only the page's. Verify by a case that fails if the worker's request is the one left unfilled — otherwise a green run could be a live call.
- [x] 7.2 A case that activation reaches the provider **through the worker** while the page itself refuses cross-origin requests, and the address reaches the field. Verify the page's hostile CORS posture is established before the assertion, not assumed.
- [x] 7.3 A case that the page's own code reads the created address back as the field's value, on a controlled input, so this path is covered by the same property slice 1 established for insertion.
- [x] 7.4 A case that a second activation while one is outstanding causes no second provider request to the provider.
- [x] 7.5 A case that the wait passing with nothing stored reports **could not confirm**, and reports no failure and no absence of mailboxes.
- [x] 7.6 A case that the worker retained nothing: a second request creates an independent mailbox.
- [x] 7.7 A case that a provider refusal reaches the page in the provider's own words.
- [x] 7.8 A negative control for each sweep in this group, so a pattern matching nothing cannot satisfy the assertions above it.


### What group 7 found, recorded because three of these were not the task as written

**1. A product defect, in the wrong handler, and the browser tier found it on its first run.**
`D8` put the outstanding-request exception in the *removal* branch, so `onFocusOut` returns while
a request is out - and tabbing away appeared to be handled. It is not: **`focusin` reaches the same
controller for whatever was focused next**, and every branch of `onFocusIn` either removes the
control or builds a new one. A person who pressed *Create* and then tabbed to the next input lost
the only place the answer could be reported. Repaired, and the repair is `design.md` D11; the delta
gained the scenario the repair introduces, because "leave the control alone while an answer is out"
and "offer nothing new while an answer is out" are two claims and only the first was written down.

**2. `7.2` could not be staged the way it was written, and the reason is worth keeping.** The task
says the page must be shown to refuse cross-origin requests, and the first implementation asserted
exactly that by having the page attempt the same `fetch` and requiring a CORS failure. **It does
not fail**: with `context.route` answering the provider origin, the page's own cross-origin
`fetch` succeeds and returns the recorded body - measured, not reasoned, and the probe's output is
quoted in the case. A route fulfilled by the harness is not a cross-origin response in the page's
sense of one. **So that version of the case would have kept passing if the extension had been
making the request itself**, which is the failure mode a case about *who* makes a request cannot
have. The fixture now serves a real `connect-src`, which the platform refuses and the harness
cannot, and the case carries a same-origin positive control so "the page's requests are broken"
cannot satisfy it.

**3. `7.7` asked for something no surface in this product produces, and was corrected rather than
satisfied.** The task says the refusal reaches the page "in the provider's own words". It does not,
and never has: the adapter classifies a throttled creation as `RATE_LIMITED` and substitutes its
own sentence, so the provider's recorded body is discarded upstream of the page. The requirement
was amended, the case asserts what the control actually reads - the manager's composed report
naming every provider asked, each with its id and its normalised condition - and `design.md` D12
records why that is a correction rather than a weakening. **A task that names words no code
produces is a task that would have been satisfied by a test asserting nothing.**

**4. Two of this group's cases asserted the wrong shape of the product's behaviour, and both were
the task's fault rather than the code's.** A control does not survive a successful insertion - it
is removed, because there is nothing left to offer - and a field that acquired text is refused the
affordance outright, so the "offers insertion next time" case has to use a field a person could
still use. Both were corrected in the *expectation*, and the second is why the case reaches for
`#in-form` rather than the field it typed into.

**5. A precondition defect in this file, which is the fifth recorded instance of that shape.** A
case that releases its gate and returns leaves the harness fulfilling a provider request and the
worker writing a mailbox **after** the next case has cleared storage and booted its page. That next
case then finds an address it did not create, offers insertion where it meant to offer creation,
and fails on an assertion that says nothing about itself - which is exactly how it presented. Every
case that starts provider work now finishes it, and the "could not confirm" case's late-answer half
is what drains it. **Closing the page does not fix this**: the request has already been dispatched,
and a closed document cannot recall it.

## 8. Falsification

- [ ] 8.1 The harness lives **outside the repository tree**, per slice 1's task 7.6, and reports `harness-error` for an output containing neither a passed nor a failed count.
- [ ] 8.2 Deliberate violations for each new assertion, including **one targeting the retargeted boundary rule** — a fresh-path probe the rule must report — and one removing the outstanding-answer hold.
- [ ] 8.3 Each violation must be caught by its **intended** assertion, with restoration verified by SHA-256 and `dist/` rebuilt from the restored source. Record the full table in `design.md`, including any that survived.

## 9. Gates, counts, and records

- [ ] 9.1 `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, recorded per run including every red.
- [ ] 9.2 `pnpm test:browser` as three blocks of ten, counting failures, and stating any exception rather than claiming the tree was frozen.
- [ ] 9.3 Test counts from `--reporter=json` grouped by project — never transcribed — recording the baseline before this change and the delta. `packages/ui` must still be 38.
- [ ] 9.4 Update `AGENTS.md`, `docs/ROADMAP.md` and `README.md` with observed counts and with the new limits this slice adds, including that no case here reads a rendered pixel and that nothing about a real provider's latency is measured.
- [ ] 9.5 `openspec validate in-page-mailbox --type change --strict`, and `openspec validate --specs --strict` to confirm nothing promoted was disturbed.
- [ ] 9.6 Record which tasks are **deliberately unticked** and why — a human opening a real site is not a judgement an agent can make on the task's behalf.