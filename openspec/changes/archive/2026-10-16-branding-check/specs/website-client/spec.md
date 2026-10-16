# Spec Delta

## ADDED Requirements

### Requirement: The public name is one exported value, and the website renders that value wherever it names the product

The product's public name SHALL be declared exactly once, as an exported value in the
shared token layer, and every website surface that names the product SHALL render that
value rather than a spelling of its own.

**The website names the product in exactly two surfaces, and both are checked.** The
wordmark is the page's product region, and `page-composition` already makes that region
take its name from its heading; the document's own `<title>` is the text a browser tab,
a bookmark and a history entry show, and **nothing in the website imports it** because it
is a build input.

**This requirement exists because the property is not currently true, and the gap is
measurable.** The name appears in **30** string and template literals across the shipped
tree, and **two** of the website's own surfaces spell it as bare text rather than reading
one value.

**The shared value is a token-layer export rather than a client's, because the value is
shared by definition.** `packages/ui`'s own module documentation states the rule that
decides it: *"Moving components into a shared package before anything needs them shared
risks freezing an API shape no second client ever agreed to. **Tokens are different: a
palette is shared by definition and its interface is data, not behaviour.**"* A product
name is shared by definition and is not a component, so neither half of that sentence
applies to it.

**What this requirement does not say.** It does not say every occurrence of the name in a
shipped file is the name. `"Guerrilla Mail is asking SpectreMail to slow down"` is copy
that is correct, and a rule that required every occurrence to equal the constant would
forbid it. **The property is about the surfaces where the product names itself, and it is
not expressible as a property of string occurrences** — which is why it is checked against
a declared map of those surfaces rather than by a scan.

#### Scenario: The page's wordmark is rendered

- **WHEN** the page renders its product region
- **THEN** the heading's text SHALL be the exported public name
- **AND** it SHALL NOT be a literal spelling of the name held in the component

#### Scenario: The website's document is built

- **WHEN** the website's HTML document is read as a build input
- **THEN** its `<title>` SHALL be the exported public name
- **AND** the check SHALL read the file, because no module imports a build input

#### Scenario: A website surface is checked against the map

- **WHEN** every surface named in the map is inspected
- **THEN** each SHALL render the one public name
- **AND** a surface that renders a different name SHALL be reported by name rather than
  by a count

#### Scenario: A surface names the product and the map does not

- **WHEN** the shipped website names the product as the product from a place the map
  does not name
- **THEN** that place SHALL be reported by name
- **AND** the report SHALL distinguish a surface that renders the name from a copy
  string that contains it