# Spec Delta

## ADDED Requirements

### Requirement: The extension's surfaces render the one public name, and its manifest's two name fields agree

Every extension surface that names the product SHALL render the exported public name,
and the two distinct name fields in the extension's manifest SHALL both carry that value.

**The extension names the product in eight surfaces, and they are checked by two different
mechanisms because they are two different kinds of thing.** Four are **build inputs** —
the manifest's `name`, the manifest's `action.default_title`, the popup's document title
and the side panel's document title — and no module imports any of them. Four are
**components**: the popup's heading, the side panel's heading, and one heading in each of
the two composition roots, in the branch taken when that client's own storage could not be
read.

**Amendment, recorded during apply (2026-10-16).** This said *six* surfaces and *two*
components. The extra two are `main.tsx` and `panel-main.tsx`, each rendering a heading as
a bare literal in the storage-not-readable branch, and **the root orchestrator's own
measurement is the source of the wrong figure** — the table this delta was written from
listed the files it had read and did not read these two. The requirement's own instrument
found them from the other direction: every place the shipped tree holds the name must be
declared, and two places were not declared. **The count in a requirement is a measurement,
and this one was a reading**, which is the difference this repository has recorded most
often.

**The side panel already does this and is the pattern the other seven should adopt.**
`panel-copy.ts` holds the name as a copy constant and the panel renders it in three
places, so **one value renders three times**. Ten lines away, in the same directory, the
popup's heading is spelled as a bare literal **three times in one component**, beside a
`popup-copy.ts` that already exists. **A requirement that generalises an instance this
repository already got right is narrower and harder to misread than one asking for a new
idea**, and this is that requirement.

**The manifest's two name fields are separate obligations, and nothing in this repository
currently relates them.** `name` is the extension's listing name — the text the store
shows and the text that identifies the published extension — and `action.default_title` is
the toolbar tooltip. **They are the same string today by coincidence of authorship.** A
change that renamed one and not the other would publish a listing named one thing beside a
toolbar named another, and **every test in this repository would stay green**, because no
test can read a store listing.

**These build inputs are exactly where a rename is most likely to be missed.** They are
not in the TypeScript graph, so a change that updates components and copy is not required
to see them.

**What this requirement does not say.** It does not say every occurrence of the name in a
shipped file is the name. `"SpectreMail could not read its own storage, so it will not
create an address"` is copy that is correct, and `"Use SpectreMail"` is a control label
whose text is a phrase about the product rather than the product's name. **The property is
about the surfaces where the product names itself**, and it is checked against a declared
map of those surfaces rather than by a scan for the string — a scan would also fire on the
browser tier's own planted fixtures, which is a failure mode this repository has recorded
five times.

#### Scenario: The popup and the panel are rendered

- **WHEN** the popup renders its heading and the panel renders its heading
- **THEN** each SHALL render the exported public name
- **AND** no shipped extension component SHALL hold the name as a bare literal in place
  of that value

#### Scenario: A build input is checked

- **WHEN** the manifest and the two extension HTML documents are read from disk
- **THEN** the manifest's `name` and the manifest's `action.default_title` SHALL both be
  the exported public name
- **AND** both documents' `<title>` elements SHALL be the exported public name
- **AND** the check SHALL read each file, because no module imports a build input

#### Scenario: The two manifest name fields disagree

- **WHEN** the manifest's listing name and its toolbar tooltip are not the same string
- **THEN** that SHALL be reported by name
- **AND** the report SHALL name both fields rather than report a count

#### Scenario: An extension surface names the product and the map does not

- **WHEN** the shipped extension names the product as the product from a place the map
  does not name
- **THEN** that place SHALL be reported by name
- **AND** the report SHALL distinguish a surface that renders the name from a copy
  string or a control label that contains it