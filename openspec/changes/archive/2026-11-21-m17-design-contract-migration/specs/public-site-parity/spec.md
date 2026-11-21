# public-site-parity

The public, no-account, free web surface is part of the product's specified behaviour. It is
measured, not invented: M16 captured its routes, order, geometry and states, and M17 maps each
row to either an implemented SpectreMail surface or a recorded, approved deviation.

## ADDED Requirements

### Requirement: The public page renders the measured full-page structure

The website SHALL render the working product first, followed by the below-fold information
sections and the footer in the order declared by the M16 inventory. Each region SHALL have its
own heading and its own stable hook. Copy SHALL be original SpectreMail text that preserves the
informational role of each measured section; protected reference prose and graphics SHALL NOT be
copied. The footer SHALL carry the public no-account route links and attribution the inventory
records, and SHALL make no licence or independent-server claim.

#### Scenario: The full page is rendered

- **WHEN** a visitor opens the website at each viewport named by the verification plan
- **THEN** the product region SHALL appear before the information regions
- **AND** the information regions and footer SHALL appear in the declared order
- **AND** every region SHALL be reachable by its own accessible name

### Requirement: Every discovered public free route has an implementation decision

For each public no-account free route captured by M16, the repository SHALL record either an
implemented SpectreMail route or an approved deviation with its reason. A route SHALL NOT be
dropped silently because it was below the fold or outside the first screenshot. Premium,
authenticated, app-only and advertising destinations SHALL be recorded as out of scope rather
than faked.

#### Scenario: The route inventory is complete

- **WHEN** the parity review reads the M16 inventory
- **THEN** every in-scope route row SHALL name an implementation or an approved deviation
- **AND** no out-of-scope row SHALL be counted as a delivered feature

### Requirement: Full-page visual comparison uses matched viewports

A repeatable comparison SHALL capture the reference and SpectreMail full pages at the viewports
declared by the verification plan, with dynamic address and timestamp values masked. A mismatch
in layout SHALL NOT be masked; only genuinely dynamic values SHALL be excluded. Each baseline
SHALL record its capture date, viewport, zoom, font-loaded status and mask rationale.

#### Scenario: A full-page baseline is checked

- **WHEN** a maintainer runs the documented comparison procedure
- **THEN** a reference artifact and a local artifact SHALL exist for every declared viewport
- **AND** each artifact SHALL carry capture metadata
- **AND** any intentional deviation SHALL be named rather than silently excluded
