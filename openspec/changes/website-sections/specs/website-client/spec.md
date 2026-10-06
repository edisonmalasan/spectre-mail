# Spec Delta

## ADDED Requirements

### Requirement: The page's limits are stated in its footer

The list of what the page can and cannot do SHALL be rendered in the page's footer rather than
in a region between the product and the end of the page, and SHALL keep its current content:
which provider it reaches, what it does with messages, that it does not copy codes or follow
links, and that no server is involved. The footer SHALL state the same facts, and SHALL NOT
drop a limit to make room for a section.

**Note, recorded during proposal (2026-10-06).** The limits list is **not** being removed or
shortened, and this requirement says so in terms that can be checked rather than in terms that
can be admired. Its four bullets are each a measurement or a promoted requirement: the provider
is the measured CORS one from `provider-config.ts`, the code-and-link sentence is `website-
client`'s own *"This slice shows what it found and does not act on it"*, and the no-server
sentence is the architecture rule that SpectreMail never proxies a provider. Moving them to a
footer is a placement change; the claims travel with them intact.

The reason the placement changes at all is that the list reads as an apology in the middle of
a page. As a footer it reads as a specification, which is what it is.

#### Scenario: The limits are read

- **WHEN** a visitor reads the page's footer
- **THEN** it SHALL state which provider the page reaches and that no other
- **AND** it SHALL state that the page does not copy codes or follow links
- **AND** it SHALL state that no server is involved and no provider request is relayed

#### Scenario: A section needs the space

- **WHEN** a section is added to the page
- **THEN** no limit SHALL be dropped from the footer
- **AND** no limit SHALL be reworded into something the product cannot support

#### Scenario: The storage claim is placed

- **WHEN** the footer states what this device keeps
- **THEN** it SHALL point to the region that offers the removal control
- **AND** it SHALL NOT restate a guarantee about storage that the region itself owns