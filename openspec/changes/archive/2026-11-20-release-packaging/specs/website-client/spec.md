## ADDED Requirements

### Requirement: The document states what the page is, and carries the mark its tab shows

The website's HTML document SHALL declare **one** description of what the product does, and SHALL
declare the product's mark as the icon a tab shows. The description SHALL be a single sentence
stating the product's purpose, and the icon SHALL be the product's mark **rendered from the same
path data the page draws it from**.

**These are the two things about the page that no component can declare.** The title is already held
to the exported public name by reading the document, for the same reason: a build input is checked
by reading it, because no module imports it. The description and the icon share that property and
did not have that check — measured 2026-11-20, the document carried a `<title>` and nothing else, so
a search result, a link preview and a browser tab all had nothing but the name and a placeholder.

**The icon is data rather than a file, and that is a consequence rather than a preference.** This
page is required to draw its mark **without fetching anything** — `visual-system` forbids a
third-party asset and the browser suite asserts that no image or font file is requested at all. An
icon served as a file would be a second request for the same drawing, and a page that has to fetch
something in order to draw anything is the property that case exists to hold. **So the document
declares an inline `data:image/svg+xml` URI, and one instrument asserts its path data is the page's
own mark rather than a second drawing that happens to agree** — a duplicated drawing is the second
spelling of a set this repository records as a defect, and it would drift the first time the mark
changed.

#### Scenario: The document is read for its description

- **WHEN** the website's HTML document is read as a build input
- **THEN** it SHALL carry exactly one description of what the product does
- **AND** the description SHALL be a sentence rather than the product's name alone
- **AND** a document carrying none SHALL be reported by name

#### Scenario: The icon's path data is compared with the page's

- **WHEN** the document's declared icon is decoded
- **THEN** its path data SHALL equal the path data the page draws its mark from
- **AND** an icon drawn from different path data SHALL be reported by name

#### Scenario: The page is loaded with a description and an icon declared

- **WHEN** the built page is opened in a browser
- **THEN** it SHALL request no image and no font file
- **AND** the icon SHALL still be present, because it was never a request
