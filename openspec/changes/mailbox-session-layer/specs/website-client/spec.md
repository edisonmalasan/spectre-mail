# Spec Delta

## Purpose

Describes what the SpectreMail website must do on a user's first visit and every
visit after: reach a provider it can actually use, hand the user a working
temporary address, and tell the truth about the address's status and lifetime.

## ADDED Requirements

### Requirement: The website reaches Guerrilla Mail and no other provider

The website SHALL configure exactly one provider, Guerrilla Mail, and SHALL NOT
configure Mail.tm, offer it as a fallback, or probe for it.

**Note, recorded during proposal.** Mail.tm sends CORS headers only to its own
origins, so no compliant web page can reach it — measured, not assumed. A
SpectreMail-operated backend to relay it is explicitly forbidden by
`provider-abstraction`. Configuring it here would therefore produce a runtime
failure whose cause the user could not see and could do nothing about. The
extension's Mail.tm-primary policy is unchanged; this is a client-configuration
fact, not a verdict on the provider.

#### Scenario: The website page loads

- **WHEN** a page of the website is served and its provider configuration is read
- **THEN** exactly one provider SHALL be configured
- **AND** it SHALL be Guerrilla Mail
- **AND** no request SHALL be made to any other provider's origin

#### Scenario: The provider selector is present

- **WHEN** the website renders a provider selector
- **THEN** it SHALL offer no provider that the website cannot reach
- **AND** its absence SHALL NOT be presented as a missing feature

### Requirement: The website creates a mailbox without asking

On load the website SHALL create a mailbox and present its address, without
requiring an account, a sign-up step, an email address of the user's own, or any
other information from the user.

#### Scenario: A first-time visitor arrives

- **WHEN** the website is opened for the first time on a device
- **THEN** a mailbox SHALL be created
- **AND** its address SHALL be presented
- **AND** no form SHALL have been required first

#### Scenario: Creation is still in progress

- **WHEN** the page has loaded but no mailbox has been created yet
- **THEN** the website SHALL say so
- **AND** it SHALL NOT display a placeholder address, an example address, or any
  address it did not receive from the provider

### Requirement: The address is presented as text the user can take

The address SHALL be rendered as selectable text in a form that identifies it as
an address, and the website SHALL offer a way to place it on the clipboard. If the
clipboard cannot be written, the website SHALL say so rather than appear to have
succeeded.

#### Scenario: The user copies the address

- **WHEN** the user activates the copy action
- **THEN** the address SHALL be placed on the clipboard unchanged
- **AND** the website SHALL confirm the copy happened

#### Scenario: The clipboard refuses

- **WHEN** the copy action is used and the clipboard is unavailable or refused
- **THEN** the website SHALL report that the copy did not happen
- **AND** the address SHALL remain visible and selectable

#### Scenario: The address is read aloud

- **WHEN** a screen reader reaches the address
- **THEN** the element SHALL be exposed as text rather than as an image or an
  unlabelled control
- **AND** the copy action SHALL have a name that says what it copies

### Requirement: The website never claims a mailbox lifetime it cannot know

The website SHALL NOT display a countdown, an expiry time, or a remaining lifetime
derived from a creation time or a documented limit. Absent an expiry the provider
itself reported, the website SHALL say the lifetime is unknown.

**Note, recorded during proposal.** `provider-abstraction` already requires that
mailbox lifetime not be assumed, and this states the consequence for the screen a
user reads. Mail.tm publishes a 7-day retention and says a mailbox lasts until
deleted, but neither value appears in any API response and neither was measured
live; Guerrilla publishes nothing equivalent. A countdown computed from either
would be a number the product invented, and it would be wrong in the one direction
that costs a user a verification code.

#### Scenario: The created mailbox carries no expiry

- **WHEN** the website receives a mailbox with no expiry the provider reported
- **THEN** it SHALL state that the lifetime is unknown
- **AND** it SHALL NOT display a countdown or a number of minutes remaining

#### Scenario: The provider does report an expiry

- **WHEN** the website receives a mailbox carrying a provider-reported expiry
- **THEN** it MAY display that expiry
- **AND** it SHALL attribute it to the provider rather than present it as
  SpectreMail's guarantee

### Requirement: A failure is visible and retryable

When the website cannot obtain an address it SHALL say so in the user's terms,
name the condition when it is known, and offer a way to try again. It SHALL NOT
show an empty address, an example address, or a silent failure.

#### Scenario: The provider refuses

- **WHEN** mailbox creation fails
- **THEN** the website SHALL state that no address could be created
- **AND** it SHALL offer a retry
- **AND** it SHALL NOT display any address

#### Scenario: The provider is throttled

- **WHEN** mailbox creation fails for rate-limit reasons
- **THEN** the website SHALL say the provider is asking it to slow down
- **AND** it SHALL NOT retry automatically on the user's behalf

### Requirement: The website renders no provider data as markup and no provider field

The website SHALL render untrusted message and provider content as text only, and
SHALL NOT contain a provider's JSON field name or interpret a provider's response.

#### Scenario: The website sources are inspected

- **WHEN** every file under the website client is scanned
- **THEN** no provider JSON field name SHALL be found in it
- **AND** no file SHALL contain a provider adapter identifier

#### Scenario: The page renders

- **WHEN** the website renders
- **THEN** no value received from a provider SHALL be inserted as markup
- **AND** untrusted content SHALL be escaped by the rendering layer rather than
  pre-rendered to HTML by the client

### Requirement: This milestone builds structure, not visual design

The website SHALL present a working page with correct structure, accessible names,
and states. It SHALL NOT apply the approved visual system, design tokens, or a
layout system, because the design milestone owns those and building them here
would produce markup that milestone rewrites.

#### Scenario: The page is built

- **WHEN** the website's production build runs
- **THEN** it SHALL build and serve
- **AND** the milestone SHALL NOT have introduced a design token or theme system

#### Scenario: Each state is reachable

- **WHEN** the page is in its creating, ready, or failed state
- **THEN** each SHALL be rendered as distinct, labelled content
- **AND** none SHALL be conveyed by colour alone
