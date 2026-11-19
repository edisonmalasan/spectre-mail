## MODIFIED Requirements

### Requirement: A message that arrives raises a notification naming its sender and its subject

The extension SHALL raise one notification for each message in the watched mailbox whose id this
device has not already been told about, and that notification SHALL carry **the sender and the
subject, and no other value from the message**.

**The notification SHALL NOT carry a one-time code, and that is structural rather than a filter.** A
notification is readable on a lock screen, in an operating system's notification centre, and through
device pairing — every one of them outside the browser, and therefore outside every privacy control
this product enforces. A `MessageSummary` carries no body at all, by product principle
(`packages/core`: *"listing a mailbox must not require fetching bodies"*), so a notification built
from a summary **cannot** contain a code, and the check that raises it **reads no message body at
all**.

**And that half was measured, because the first version of it was a promise about intentions rather
than about requests.** It read *"the check that raises it never opens a message"*, which was true of
`openMessage` and silent about everything else: the wake's listing went through the shared session's
verdict pass, which reads each body it has not already read, so a wake had already fetched the very
body whose code it was declining to put on a lock screen. `mailbox-session`'s listing-without-bodies
requirement is what closes it, and the browser case that counts a wake's requests is what found it.

**Every notification SHALL carry the shipped raster icon, and that is load-bearing rather than
decorative.** Measured on 2026-10-11 against this Chromium, unpacked and headless: a notification
created with **no `iconUrl` resolves its callback and registers nothing**, so the callback reports
success for a notification the platform does not hold. An `iconUrl` naming an SVG is **refused
outright**, the callback resolving `null`. Only a raster image both resolves and is registered. The
icon is therefore the difference between the platform holding a notification and silently producing
none, and a build whose output does not carry the file SHALL fail rather than ship notifications the
platform is refusing.

**A notification that could not be created SHALL be reported, and SHALL NOT advance what this device
has been told.** The platform's only observed rejection signal is a `create` callback resolving
**`null`**, so that is what the wake reads. **This requirement names no error event, because there is
none to name:** `chrome.notifications.onError` does not exist on the Chromium measured, so a
requirement resting on it would describe a channel no implementation could ever observe — and a
wake that assumed success would record a message as announced and tell nobody, the same defect
`in-page-fill` found in a control that removed itself from the page without telling its caller. The
property is that the set of ids this device holds grows **only** on a notification the platform
answered for, so one that failed is raised again by a later wake rather than swallowed.

**The callback alone is not evidence, and the requirement does not claim it is.** It resolved for an
arm that registered nothing, which is why the icon is mandatory above rather than preferred. This
capability makes no claim about a notification having been **seen**: nothing in this repository can
observe an operating system's notification centre, and `create` answering is a smaller fact than
that.

#### Scenario: A message this device has not seen arrives

- **WHEN** a check finds a message whose id is not among the ids this device was last told about
- **THEN** it SHALL raise one notification naming that message's sender and subject
- **AND** it SHALL name no other value from that message

#### Scenario: The notification is examined for a code

- **WHEN** a notification raised by a check is read
- **THEN** no one-time code detected in that mailbox SHALL appear in it

#### Scenario: A notification cannot be created

- **WHEN** the platform answers a `create` with a null id, or throws rather than answering
- **THEN** the wake SHALL NOT record that message as one this device has been told about
- **AND** a later wake SHALL raise it again
- **AND** it SHALL report the message as one it did not announce, rather than report that nothing
  happened

**Amendment, recorded during apply (2026-10-11).** **Two clauses were added, and both were added
because a test failed against a product that was otherwise correct.**

**A `create` that throws is the same answer as one that resolves `null`.** `docs/PROVIDERS.md` §4.5
measured no error channel on this Chromium — `chrome.notifications.onError` does not exist — so the
only observed refusal is the callback's own value. **A throw is the one shape a callback-based API
can refuse in**, and treating it as an unhandled fault would leave the message unrecorded for the
opposite reason to the one that matters: the record would advance only if the failure happened to be
a value.

**The wake reports the message as one it did not announce.** The outcome union originally had a
single `quiet` arm, reached whenever the id set was unchanged — **which is exactly the state a
refused notification produces**, because a refused message is not recorded and the set therefore did
not change. So a wake the platform had just refused a notification for reported *"nothing happened"*
while having happened, and the retry the first clause depends on depended on the caller being told.
`quiet` is therefore split into `unchanged` (nothing was asked of the platform and the set is the
same) and `pruned` (nothing was asked of the platform and the set shrank), and an arm claims
notifications were raised **when something was attempted**, not when something succeeded. **An arm
claiming a notification was raised when none was is the same defect as a record that advanced on a
refused one**, and only the second of the two was visible when this requirement was written.

#### Scenario: The notification could not be raised and the record did not change

- **WHEN** every message in a listing has already been announced and a notification is refused
- **THEN** the wake SHALL raise no notification
- **AND** it SHALL not rewrite the record, because replacing it with itself is not a change

#### Scenario: A notification is raised without the shipped icon

- **WHEN** a notification is raised without the raster icon this extension ships
- **THEN** the platform SHALL be asked for a notification it does not hold
- **AND** no requirement above is satisfied by the callback resolving

#### Scenario: A build whose output carries no icon

- **WHEN** the built extension output does not carry the shipped icon file
- **THEN** the extension's browser suite SHALL fail
- **AND** no notification requirement above is claimed to be met

**Amendment, recorded during apply (2026-10-11).** **"The build SHALL fail" became "the extension's
browser suite SHALL fail", and the reason is that the build cannot fail here.**

`vite build` copies `static/` verbatim and checks nothing about its contents, so an icon missing from
the output is not a build failure — **and the icon cannot be missing from a build that succeeded**,
because the two are the same directory copy. The first version of this clause would therefore have
been satisfied by a build script nobody writes: it described a gate that does not exist, which is the
same shape as a boundary rule enforcing a rule that was retired.

The claim is enforced where it can be, by `manifest.spec.ts` **reading the emitted artefact**: the
PNG signature and its `IEND` chunk, so a truncated write and an HTML error page served in its place
are both refused, and `manifest.icons`/`action.default_icon` naming members of the one icon family
this extension ships, so the icon a notification is given is the same artefact the manifest also
declares. **A test in the browser tier is the right instrument rather than a convenient one** — the
failure this exists to catch is silent by measurement (§4.5: the callback resolves and the platform
registers nothing), so nothing short of reading the artefact and reading the registration would ever
notice it.

**Amendment, recorded during proposal (2026-11-20), by `release-packaging`.** **One clause above is
replaced, and the property it held is kept.** It read *"and `manifest.icons`/`action.default_icon`
staying `undefined`, so the icon is reachable only from a notification"*.

**That was the right reading while an icon had exactly one consumer.** It is the wrong reading for a
product that has to be handed to somebody: a manifest declaring no icons is drawn by Chromium with a
generic placeholder — in the toolbar, in the extensions page, and in a store listing — so the
product's mark would reach a person only inside a notification, after they had already installed it
under a grey puzzle piece. **The raster icon was never the problem; its absence everywhere else
was.**

**The extension now ships an icon family the manifest declares, and that is the next requirement.**
This one's claim narrows to **the icon a notification is given**: it SHALL be a raster image the
built output carries, it SHALL be a member of that family, and the extension's browser suite SHALL
fail when it is absent. **What changed is that the same artefact is now also reachable from the
manifest — not that a second icon exists.**

## ADDED Requirements

### Requirement: The extension ships one icon family, and the manifest declares it

The extension SHALL ship the product's mark at **16, 32, 48 and 128** pixels, `manifest.icons` SHALL
declare every one of them, and `action.default_icon` SHALL name a member of that family rather than a
fifth file. The 128 SHALL be the raster file this extension already shipped, byte-identical, and the
smaller sizes SHALL be derived from it.

**Four sizes because three different surfaces ask for three different sizes** — a toolbar, an
extensions page, and a listing — and one 128 scaled down by the platform is a different image from
one drawn at the size it is shown at. **The 128 being byte-identical is the claim that this is a
move and not a redraw**: the mark did not change, and a change that redrew it while calling itself a
packaging change would be unreviewable.

**One directory is the mark's home.** A file for the manifest and a second for the notification would
be the second spelling of a set this repository records as a defect, and the two would drift the
first time the mark changed. **Nothing here claims a person judged how the smaller sizes look** —
what is asserted is that they are the product's mark, in the accent the token layer declares, and
that a missing size is named rather than shipped as a placeholder.

#### Scenario: The manifest declares the icon family

- **WHEN** the built manifest is read
- **THEN** `icons` SHALL name a file for each of the four sizes
- **AND** every file it names SHALL be present in the built output
- **AND** `action.default_icon` SHALL name one of those files

#### Scenario: An icon the manifest names is not the mark

- **WHEN** an icon in the shipped family is decoded
- **THEN** it SHALL carry the accent the token layer declares
- **AND** it SHALL NOT be a second drawing of the mark with different geometry

#### Scenario: A size is absent

- **WHEN** the built output is missing one of the four sizes
- **THEN** the extension's browser suite SHALL fail, naming that size

### Requirement: The extension is packaged into one archive a store can accept

One command SHALL produce a single archive of the built extension, and `manifest.json` SHALL sit at
the archive's root rather than inside a directory. The archive SHALL be produced from that client's
own build output, SHALL carry the version the built manifest declares, and SHALL contain every file
the manifest names by literal filename.

**A store rejects an archive for shapes this repository can check without uploading one**, and each
of them is silent at submission time: a top-level folder, a manifest that is not at the root, and a
named entry point the archive does not carry. **The command SHALL be reproducible** — two runs over
the same build output SHALL produce the same bytes — because an artefact whose bytes change on every
run cannot answer the only question a maintainer asks of it: *did this rebuild change anything?*
**The archive is a build output and SHALL NOT be committed**, and the repository's ignore rules
SHALL name the directory it is written to.

#### Scenario: The archive is opened at its root

- **WHEN** the archive is inspected from its central directory
- **THEN** `manifest.json` SHALL be present with no directory prefix
- **AND** every other entry SHALL be relative to the same root
- **AND** no entry SHALL carry a leading `dist/` or a top-level folder of its own

#### Scenario: Every file the built manifest names is inside

- **WHEN** each filename the built manifest declares is looked up in the archive
- **THEN** every one SHALL be present
- **AND** a missing entry point SHALL be reported by name rather than as an archive that produced
  nothing

#### Scenario: The archive's version is the manifest's

- **WHEN** the archive is produced
- **THEN** the version it reports SHALL be the version the built manifest declares
- **AND** the version SHALL NOT be typed into the command or into a second file

#### Scenario: The archive is built twice

- **WHEN** the command runs twice over unchanged build output
- **THEN** the two archives SHALL be byte-identical
- **AND** the entry order SHALL NOT depend on the order the filesystem happens to list

#### Scenario: There is no build output to package

- **WHEN** the command runs with no built output
- **THEN** it SHALL refuse, naming the path it looked for
- **AND** it SHALL NOT write an empty or partial archive

