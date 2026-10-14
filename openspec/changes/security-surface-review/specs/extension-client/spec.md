# Spec Delta

## ADDED Requirements

### Requirement: The extension renders provider-supplied content as text

The extension SHALL render every value that came from a provider — a sender, a
subject, a readable message body, a detected code, a detected link and its host — as
text, and SHALL insert none of them into the page as markup.

**This requirement exists because the property is already enforced and was not
stated.** A boundary rule in `tests/architecture/boundaries.test.ts` keeps a markup
escape hatch out of **every** client, and it fires on this extension's files. **A rule
that fires without a requirement behind it is a rule whose removal nobody would
notice**, because the document that justified it names the other client and not this
one.

The website states the same property for itself in `website-client`, and
`shared-domain-model` and `provider-adapters` both state that message bodies are
carried as untrusted text. **This is the third place that property is written down,
which is the point rather than the problem**: it is written down per client, because a
client that stopped rendering provider content as text would be a defect in that
client, and a requirement filed under another client's capability would attribute it
to the wrong assertion.

The extension renders provider content in **two** shipped surfaces and neither is a
standalone document: the popup and the side panel share one message surface. **That is
recorded here rather than left for a reader to discover**, because a shared component
serving two surfaces is the shape where one surface's requirement can be satisfied by
the other's implementation.

#### Scenario: The extension's sources are inspected

- **WHEN** every file under the extension client is scanned
- **THEN** no file SHALL contain a markup escape hatch
- **AND** the scan SHALL cover every file under the client rather than a named
  subset, so that a new surface is covered by being created

#### Scenario: A message is shown in the popup or the panel

- **WHEN** the extension renders a sender, a subject, a message body, a detected
  code or a detected link
- **THEN** each SHALL appear as text content of an element
- **AND** no value received from a provider SHALL be inserted as markup

#### Scenario: A detected link is offered

- **WHEN** a detected verification link is rendered
- **THEN** its destination SHALL be one the parser has already restricted to `http`
  and `https`, which `mail-parsing` already requires
- **AND** the extension SHALL NOT widen that set at the point of rendering

#### Scenario: The control is rendered inside somebody else's page

- **WHEN** the content script renders its address control inside a third party's
  document
- **THEN** that control SHALL render its own content as text as well
- **AND** it SHALL NOT place a value received from a provider into the page as
  markup