# Spec Delta

## Purpose

Records what a stylesheet owes once this repository has one. Until M7 the page had no
design system at all, so there was nothing for a requirement to constrain: a palette
declared in twenty places is not drift, it is the only thing that exists yet.

## ADDED Requirements

### Requirement: The design tokens are declared once and read from one place

Colour, type family, type scale, spacing step, radius, and border width SHALL each be
declared exactly once, in a token layer shared by every client. No stylesheet outside that
layer SHALL name a colour, a radius, a spacing step, or a type size directly, and every
`var()` a shipped stylesheet reads SHALL resolve to a declaration.

**Note, recorded during proposal (2026-10-06).** The third clause is not a style
preference. An undeclared custom property makes `var()` compute to the initial value at
computed-value time, so `--colour-accent` declared nowhere against a token spelled
`--color-accent` renders an element **with no accent and no error anywhere**. It builds,
it type checks, every test passes, and the defect is a single pixel on one control. That
is the same failure shape as the removal control that shipped and was measured absent: a
claim nothing in the repository could read.

#### Scenario: A stylesheet reads a token

- **WHEN** a shipped stylesheet styles a property whose value is a design decision
- **THEN** it SHALL reference the token for that decision
- **AND** it SHALL NOT name a colour, radius, spacing step, or type size literally

#### Scenario: A stylesheet reads a token that is not declared

- **WHEN** a shipped stylesheet reads a custom property that no token layer or stylesheet
      declares
- **THEN** the build SHALL fail, naming the stylesheet and the property
- **AND** the failure SHALL occur before the page is served

#### Scenario: A second client needs the palette

- **WHEN** a client other than the website is built
- **THEN** it SHALL read the same token layer
- **AND** no palette value SHALL be restated in that client

### Requirement: The page loads no third-party asset

No stylesheet the product ships SHALL reference a remote origin, and the product's markup
SHALL declare no remote `src` or `href`. Where a typeface is wanted it SHALL be named as a
token over fonts the platform already provides, or shipped with the product.

**Note, recorded during proposal (2026-10-06).** Three reasons, each of which stands
without the others. A remote font **breaks a promoted requirement**: `build-and-verification`
requires a browser check to contact no third-party origin, the browser route handler denies
every origin it has no recorded response for, and a font request would fail every spec in
the suite. It **breaks the product**: a page whose stated subject is what is
kept on this device hands a third party the visitor's IP address and User-Agent on load,
before the visitor has done anything, and no control on the page can prevent it. And it
**adds a binary** this milestone has not measured.

The approved direction names a typeface. Naming one is an instruction about where a family
is *declared*, not a requirement to fetch it.

#### Scenario: A stylesheet references an asset

- **WHEN** a shipped stylesheet references any external resource
- **THEN** the build SHALL fail, naming the stylesheet and the URL

#### Scenario: The markup references an asset

- **WHEN** the product's markup declares a `src` or `href` resolving to another origin
- **THEN** the build SHALL fail, naming the file and the URL

#### Scenario: The page is served and inspected for what it requested

- **WHEN** the built page is loaded and every request it made is recorded
- **THEN** it SHALL have requested only the page's own resources
- **AND** no third-party origin SHALL appear in that record

### Requirement: State is never carried by colour alone

Where a control or region conveys a state, that state SHALL be carried by text, a shape, a
symbol, or a structural difference as well as by colour. No verdict, status, or error
SHALL be distinguishable only by the colour applied to it.

**Note, recorded during proposal (2026-10-06).** This requirement already existed for
`website-client` before this change, and it stays true there. It is restated here because
this milestone makes it **hard to keep**: the accent is about to appear on active status,
and an accent that recolours a verdict without naming it would satisfy the visual direction
and break a requirement that predates it. Reinforcing a word is the intent. Replacing one
is the failure.

#### Scenario: A message carries a verification

- **WHEN** an inbox row is marked as carrying a one-time code or a verification link
- **THEN** it SHALL say so in text
- **AND** the accent SHALL NOT be the only difference between it and a row that does not

#### Scenario: A region reports an error

- **WHEN** a region states that something failed
- **THEN** it SHALL state what failed and what to do about it in words
- **AND** no styling SHALL be required to perceive that it failed

### Requirement: Every interactive control has a focus indicator that is visible

Every control a user can operate by keyboard SHALL show a focus indicator when focused.
The indicator SHALL be visible against every surface it can appear on, SHALL use the
accent, and SHALL NOT be removed by any reset or override the product ships. Focus SHALL be
verifiable where the indicator exists, which is in rendered pixels.

**Note, recorded during proposal (2026-10-06).** A declared ring and a visible ring are
different claims, and only one of them is worth making. `getComputedStyle` in `jsdom`
returns no resolved outline, so a check there would assert on a declaration and pass on a
control no user can see. The check is therefore a browser check, driving focus by keyboard
rather than by script, because the indicator that matters is the one a keyboard user gets.

#### Scenario: A control is reached by keyboard

- **WHEN** a user tabs to any interactive control on the page
- **THEN** that control SHALL render a focus indicator
- **AND** the indicator SHALL differ from the same control unfocused

#### Scenario: A stylesheet removes a focus indicator

- **WHEN** a shipped stylesheet suppresses an outline, by `none`, by zero, or by zero
      width
- **THEN** the build SHALL fail, naming the stylesheet and the declaration

#### Scenario: An indicator is declared but cannot be seen

- **WHEN** a focus indicator is declared in a colour or weight that is indistinguishable
      from the surface behind it
- **THEN** the browser check SHALL fail
- **AND** no unit test over the declaration SHALL be offered in place of it

### Requirement: Declared colour pairs meet WCAG AA in both colour schemes

Every foreground-and-background pair the product declares for text SHALL meet a contrast
ratio of at least 4.5:1, and every pair it declares for a boundary, an indicator, or text
of at least 18.66px bold or 24px SHALL meet at least 3:1. Both colour schemes SHALL be
checked, and a scheme SHALL NOT be added by inverting the other.

**Note, recorded during proposal (2026-10-06).** This is arithmetic, so it is checked as
arithmetic. A relative-luminance function over the token values is a pure function and
needs no browser, no DOM, and no rendered page; putting it in a browser check would be
theatre, because the browser supplies colour strings and the test supplies the ratio.

#### Scenario: A pair is declared

- **WHEN** the token layer declares a foreground-and-background pair for text
- **THEN** the declared ratio SHALL be at least 4.5:1 in each colour scheme

#### Scenario: A pair fails

- **WHEN** a declared pair falls below its threshold
- **THEN** the test run SHALL fail, naming the pair and both ratios

#### Scenario: The dark scheme is added

- **WHEN** a dark scheme is declared alongside the light one
- **THEN** every declared pair SHALL meet its threshold in that scheme too
- **AND** the scheme SHALL NOT be produced by filtering or inverting the other
