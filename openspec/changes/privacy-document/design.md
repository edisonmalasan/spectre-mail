# Design: privacy document

## Context

M12's privacy-documentation item asks for a published document covering six things. One of
them is already **required by a promoted requirement that has nothing to point at**:

> `page-composition` → *A section states only what the product does*: "The footer ships the
> privacy and provider facts, which are true, and says nothing about licensing."

Measured on the shipped tree:

| record | where | named by a document? |
| --- | --- | --- |
| `current` — one mailbox record | `chrome.storage.local` | no |
| `mailboxes` — newest-first collection | `chrome.storage.local` | no |
| **`site-mailboxes` — `hostname` → mailbox id** | `chrome.storage.local` | **no** |
| `seen-messages` — ids already announced | `chrome.storage.local` | no |
| `mailbox` store, key `current` | IndexedDB (website) | no |

`README.md`'s privacy section is three bullets and `docs/ROADMAP.md` §29 is one word
(`local-first`). The footer's `LIMITS` carry two sentences: which provider the page reaches, and
that no server is involved. **Two true sentences about five stored records is not a privacy
model**, and nothing anywhere holds the rest.

## Decisions

### D1 — The change's headline is a record nobody names, not a document

`site-mailboxes` maps a `hostname` to a mailbox id. It is written at
`content-script/controller.ts:348` and **only after an insertion lands** — never because a
control was offered — and it is **the only browsing-adjacent record this product keeps**.

The order matters when a future reader asks *why the document leads with this*: because a
privacy document that omits the one record that resembles browsing history is **worse than no
privacy document**, since its existence implies the omission was considered. That sentence is
the change's reason for existing, and it belongs in the document itself rather than only here.

### D2 — The instrument is a new file, and the boundary count is a prediction

`tests/architecture/privacy-disclosure.test.ts`, **not** more cases in
`tests/architecture/boundaries.test.ts`.

Two reasons, and the second is the operative one.

**The two kinds of rule are different in kind.** `boundaries.test.ts` holds rules about *code
structure* — which module may import what, which identifier may appear where. This is a rule
about *a document matching the code*. Filing it under the first would make a reader of
`boundaries.test.ts` expect a code-structure rule and find a prose comparison.

**A rule added where an instrument already exists is not coverage.** `extension-permissions-review`
established this one stage ago: its boundary count **staying at 53** was the measurement that
the decision was right. **53 staying at 53 here is the same claim** — this change adds no
boundary, because every property it introduces is about a document and none of them is a
structural rule. If a later change finds a *structural* rule this document implies, it belongs in
`boundaries.test.ts` and this change's prediction will be the thing that was wrong.

### D3 — A test-owned map, not a scan — carried from D6 of the permissions review

The permissions review's instrument is a **permission → the call that reaches it** map living in
`manifest.spec.ts`, and its reasoning generalises exactly: a scan over `docs/PRIVACY.md` would
match any plausible-looking origin or key name, and a rule a pattern can satisfy is not a rule.

So the check is a **map from each enumerable claim to the shipped evidence**, written by hand in
the test, with **no claim matched by pattern**. `docs/PRIVACY.md` is read for its *sections* and
its **declared list**, and the lists are compared against constants imported from the code that
owns them — `EXTENSION_MAILBOX_KEY`, `EXTENSION_MAILBOXES_KEY`,
`EXTENSION_SITE_MAILBOXES_KEY`, `EXTENSION_SEEN_MESSAGES_KEY`, the manifest's `host_permissions`,
and each client's provider-id list.

**`tabs` is why the direction matters and why a scan would have been wrong here too**: it is
read twice in shipped code and deliberately undeclared. A pattern-based *absence* check over the
manifest is precisely the instrument that would report it as a failure, and the repair would have
been to declare it.

### D4 — Both directions, and the direction that does not exist yet is the one that matters

Every enumerable check runs **both ways**:

- **the document omits something that exists** → fail, naming the thing
- **the document names something that does not exist** → fail, naming the thing

**The second direction has no instance in this repository yet**, and it is the one that rots. A
privacy document is prose someone edits over months; the failure mode is a **stale** key name left
behind after a rename, which reads as authoritative and is wrong. The document is the artifact
most likely to be edited without running anything, which is exactly the pair of conditions this
repository records as *the* precondition defect.

Each check therefore needs **a positive control on its own reader** — the first case in the file
requires the map to *agree* with the shipped tree, and only then is any failure claim made. A
file where every assertion is negative passes on an empty map.

### D5 — No link in any client surface, and the stylesheet is therefore untouched

The document is reachable from the **README** and from the repository. **The website's footer,
the popup and the panel gain no link to it**, and the reason is mechanical rather than
aesthetic:

- a link is a new interactive control;
- `visual-system` requires **every interactive control to draw a focus indicator**, so a new
  control in the footer is a **new `styles.css` rule** — and `:focus-visible` rules are
  specificity-sensitive, where `website-sections` already recorded that source order is
  load-bearing;
- so a "small" documentation link would edit the shipped stylesheet, break the focus rule's
  register, and move a count this change depends on being unmoved.

**The requirement is therefore *agreement*, not linkage.** `page-composition` already requires the
footer to ship privacy and provider facts; the new requirement is that those facts **agree with
`docs/PRIVACY.md`**, and the instrument is what checks it. That is the honest relationship for one
canonical document with three restatements of it, and **the alternative — three copies that only
a reader notices are stale — is the defect this change exists to remove.**

A link in the extension is worse still for a reason that is not about styling: the popup and
panel are installed artefacts with no repository page in front of the reader, so a link would have
to hardcode an owner and a branch, and **a URL in shipped code that nothing checks is a claim
that expires silently at the next rename.**

### D6 — Attribution is stated in neither direction

M12 lists *provider attribution* as a required item, and this repository cannot answer it:

- **Mail.tm publishes no terms page** — verified 2026-10-02, recorded in `docs/PROVIDERS.md`;
- Guerrilla publishes nothing this repository located;
- and `AGENTS.md`'s architecture rules already forbid citing provider terms that were not
  verified.

**Claiming no obligation is exactly as unsupported as claiming one**, so the document states
*what was verified*, names the absence, and stops. This is the same rule `extension-clear-data`
followed for its removal result and `incoming-mail-notification` for its service-worker lifetime:
**an unmeasured thing is reported as unmeasured**, never resolved in the direction that reads
better.

### D7 — The provider review does not block this, and why that is a decision rather than an omission

M12's *provider review* re-checks both providers' terms, rate limits and attribution. **It is
adjacent** — it is where a verified attribution obligation would come from — and this change does
**not** wait for it.

Waiting would be defensible; not waiting is better, for two reasons.

**The document is falsifiable without it.** Every claim here is a fact about *this tree*, and the
one claim that depends on the review (attribution) is specified as an **absence**, which stays
true whatever the review finds. **If the review later locates an obligation, the document gains
one sentence and the requirement's "neither direction" clause is what stops the sentence from
being read as a change of policy.**

**Waiting would leave the hostname association undisclosed longer**, and that is the record whose
omission is the reason this change exists (D1). A privacy document that is six weeks late on its
easiest facts and early on its hardest is the wrong order.

The dependency is recorded rather than hidden: **the document carries no attribution clause that
the review has not measured**, and if the review finds an obligation it is a `privacy-disclosure`
amendment rather than a quiet edit.

### D8 — The forbidden claim is enforced by planting it

`docs/ROADMAP.md` §29 says, explicitly:

> Do not claim: *"Messages never leave your device."* — That is false while third-party providers
> receive the mail.

So that sentence is **forbidden in the document**, and the check for its absence carries a
**negative control that plants the sentence into a copy of the document and requires the same
reader to report it.**

**A sweep matching nothing satisfies every assertion above it.** That sentence has been earned
four separate times in this repository — the whole-page sweeps in `sections.spec.ts`, the
declaration-coverage case, the drift reporter, and the boundary collection rule. This is the fifth
place, and the control is not optional.

### D9 — "What SpectreMail does not collect" is a list with resolvable pointers, and self-reference is not a reason

The item is the hardest to check, because an absence of shipped surface cannot be enumerated from
the tree without the check becoming a second boundary suite — and **that would move the count
D2 says must not move.**

So the check is narrower and is chosen for being falsifiable:

- each entry is a **declaration in the document**, and each carries a **pointer** to the thing
  that supports it — a measurement in `docs/PROVIDERS.md`, a promoted requirement in
  `openspec/specs/`, or an architecture rule in `AGENTS.md`;
- **the pointer must resolve**: the named file exists and the named section is present;
- **and the document itself is not an acceptable pointer**, because a document supporting its own
  claim is the shape this whole change exists to end.

**This is weaker than proving the absence and is recorded as weaker.** It proves the claim is
*grounded*, not that the absence is *complete* — and the document says so in its own words
rather than leaving the distinction for a reader to infer. A future change may add the stronger
check; this one states the limit.

### D10 — Predictions, and what a rise in any of them means

| what | predicted | the measurement it turns on |
| --- | --- | --- |
| `packages/ui` | **38** | no token, no class hook, no CSS rule (D5) |
| `apps/web/src/styles.css` | **byte-identical** | the footer gains no control (D5) |
| `apps/extension/static/manifest.json` | **byte-identical** | nothing about the manifest changes |
| `packages/storage` | **86**, `git diff --stat` empty | the document *names* the keys; it does not change them |
| `apps/web` | **125** | the agreement is checked from `tests/architecture`, not from the client |
| `apps/extension` | **465** | no extension source change at all |
| `boundaries.test.ts` | **53** | the check is a new file (D2) |
| `openspec/specs/extension-client` | 14 / 75 | the delta adds a capability and modifies nothing |

**`apps/web` staying at 125 is the load-bearing one.** It is the only figure that distinguishes
*"the document and the page agree"* from *"the page was edited until it matched the document"*.
A rise would mean the agreement was bought with a client assertion — which is a weaker claim,
since the thing that can drift is the document.

**`packages/storage` at 86 with an empty diff is the second.** A privacy document that changed
what is stored would not be a document; it would be a change to storage wearing one.

### D11 — Two things are deliberately **not** done

**No hosting, no domain, no public URL.** A hosted privacy page is a distribution decision, and
distribution is M13's. Publishing in the repository is what "publish" can mean without a domain.

**No claim of legal sufficiency.** No jurisdiction has been considered and no compliance regime
is named. A document that said it satisfied a named regime would be making the one claim in this
repository with the least evidence behind it, and §29's own instruction is to state facts rather
than reach for reassurance.

### D12 — Where the document must **not** be summarised into

Three surfaces already carry a privacy-adjacent claim, and none of them is changed here:

- `apps/web`'s `LIMITS` — the footer;
- `apps/web`'s `LocalData.tsx` — what this browser keeps, beside the control that removes it;
- `apps/extension`'s `Panel.tsx` — the two-step confirmed removal.

**They keep their own wording.** A single shared string imported by three surfaces would make the
*copy* shared but not the *truth*, and would make a design change in one surface a change in the
other two. The requirement is agreement, checked from outside all three — which is also the only
arrangement in which the check can catch any of them drifting.

### D13 — `pnpm test` was **red on the shipped tree**, and the cause was a reader in another file that does not know what a regex literal is

**The apply-stage report said the new file's 22 cases all passed on a first run. It never ran
`pnpm test`, and `pnpm test` was red.** This is recorded first because it is the shape a reader
will otherwise miss, and because the class of defect had already been recorded in this file and
re-appeared anyway.

The failure was `boundaries.test.ts` → *"confines provider adapters to `packages/providers`"*, six
violations, every one naming `tests/architecture/privacy-disclosure.test.ts`:

```text
"tests/architecture/privacy-disclosure.test.ts references createMailTmAdapter"
"tests/architecture/privacy-disclosure.test.ts references createGuerrillaAdapter"
"tests/architecture/privacy-disclosure.test.ts references runProviderConformance"
"tests/architecture/privacy-disclosure.test.ts defines adapter-shaped identifier createGuerrillaAdapter"
"tests/architecture/privacy-disclosure.test.ts defines adapter-shaped identifier createMailTmAdapter"
"tests/architecture/privacy-disclosure.test.ts defines adapter-shaped identifier createGuerrillaAdapter"
```

**Re-measured here rather than carried forward, because the remembered shape was wrong: the six are
three identifier hits and three pattern hits, not four and two.** The total was right and the split
was not, and the split is the part that explains the mechanism.

**The mechanism, replicated.** `stripComments` in the boundary suite tracks line comments, block
comments, and three string delimiters. It has **no state for a regular-expression literal**, so a
backtick inside one opens a template string that runs to the *next* backtick in the file. The
original `normaliseProse` carried `/[*_`]/g`; from that backtick the reader was desynchronised, the
**doc comment immediately below it** — which names the three adapter identifiers while explaining
this very defect — was emitted verbatim as if it were code, and the rule read three identifiers out
of prose. The rule scans `collectSourceFiles(REPO_ROOT)`, so a file under `tests/` is in scope
exactly as one under `packages/` is.

Measured replication of the *cause*, with the pattern restored and only that restored:

- `stripComments` re-implemented byte-for-byte from the rule's own source and run over the tree:
  **235** files scanned, **1** file — this one — contains the literal;
- the restored pattern makes that single boundary case red with **the six violations above, naming
  this file**;
- restoring the repaired form makes it green, and `tests/architecture` is back to **75 passed**
  (53 + 22) with the file's SHA-256 **byte-identical** to its pre-experiment digest.

**The repair is in this file and not in the reader, and that is a boundary decision.** The defect
belongs to `stripComments`, which is out of this change's write scope. What was repaired here is
the *cause*: `normaliseProse` now removes its three markers with `replaceAll` and string arguments,
which **puts no quote character inside a pattern**, so this file can no longer desynchronise a reader
that does not understand regex literals. Same removal, spelled so that a reader in another file
cannot be desynchronised by it. The allow-list entry `"[*_`]"`,` went with the pattern, because
**an allow-list entry is not a neutral list** — keeping it would have meant keeping the red gate.

**What this does not fix, and is therefore a finding for the root orchestrator rather than a task
completed here:** `stripComments` still cannot read a regex literal, so any future file that puts a
backtick inside one is a live red gate with a green-looking cause. **A reader that cannot tell a
pattern from a string is a reader that will one day report a comment as a declaration**, which is
this repository's recorded *"a check fired on its own documentation"* shape in its reverse
direction: the documentation was right and the **other file's** reader could not see it.

### D14 — Two **declared counts**, and what a count cannot establish

The falsification pass found one real gap and one real gap read out of it by reading rather than by
mutation, both the same shape.

`expect.arrayContaining([...PANEL_REMOVAL_COPY_KEYS])` is a **subset** assertion. Deleting
`removalDoneMeans` from the list left the whole file green: the subset assertion is still satisfied
by the nine remaining keys, the per-key loop covers one key fewer, and the specification-relevant
sentence is read from `PANEL_COPY.removalDoneMeans` **by name** — so the check and the mutation were
each individually correct and together proved nothing. `WEBSITE_REMOVAL_SURFACE.markers` had the
same property for the same reason.

So both now declare a count — `PANEL_REMOVAL_COPY_KEY_COUNT = 10` and `markerCount: 3` — and assert
it **before** the loop they govern.

**A declared count establishes non-silence, not completeness.** It proves the list is not being
silently edited under the assertion; it does not prove the list is *right*. The **reverse** direction
— a removal key added to `PANEL_COPY` and forgotten here — is **not enumerable** without a name
predicate over `PANEL_COPY`, and a name predicate is exactly what D3 forbids, because a claim
matched by pattern is a claim that can be satisfied by a plausible-looking string. **The instrument
that would catch it is the instrument D3 rules out**, so the limit is stated rather than engineered
away. That trade is D3's, and this is the price of it, paid in public.

### D15 — The manifest is read from `static/`, and that is an apply-stage decision

The specification says *"the built extension manifest"*. The check reads
`apps/extension/static/manifest.json`, which **is** that manifest's content — `pnpm build` copies it
into `dist/` unchanged — and it reads the source for one reason that is about the order of two
commands: **`pnpm verify` runs `pnpm test` before `pnpm build`**, so a reader of `dist/` would report
a failure caused by which command ran first, and would report a *different* one on a machine whose
`dist/` was stale. D10's byte-identity prediction on that file is therefore checkable without a
build, which is what makes it a prediction rather than a hope.

## Risks

| risk | answer |
| --- | --- |
| The document is edited later and drifts | D4's two-way check plus D9's resolvable pointers; the drift is a red test, not a reader's suspicion |
| A scan-based reader would pass on a plausible-looking string | D3: no claim is matched by pattern; every enumerable claim is compared to a code-owned constant |
| A new storage key is added and not disclosed | D4's first direction — the check imports the key list rather than retyping it, so a fifth key fails without anyone editing the document |
| The document overstates | D6, D9, D11: attribution in neither direction, every non-collect claim grounded, and no legal claim |
| The check is vacuous | D4's positive control; a map that agrees with nothing passes every negative assertion, so agreement is asserted before any failure is claimed |
| This file desynchronises a reader in another file, and takes a green gate red with it | D13: the **cause** is repaired here and replicated in both directions; the underlying reader defect (`stripComments` has no regex-literal state) is **recorded for the root orchestrator and not closed**, because that file is outside this change's write scope |
| A declared count drifts from the list it governs | D14: the count is asserted **before** the loop it governs, so it catches a silent edit. It does **not** catch a key added to the source list and forgotten here, and that direction is not enumerable without the name predicate D3 forbids — so it is a stated limit, not a covered one |