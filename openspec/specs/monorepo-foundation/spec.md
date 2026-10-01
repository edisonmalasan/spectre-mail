# monorepo-foundation Specification

## Purpose

Defines the `monorepo-foundation` capability: the repository layout, the import
boundaries between apps and shared packages, and the structural isolation of the
disposable M0 measurement harness. These are the rules that decide where code
lands, so they are specified before any product code exists rather than inferred
from whatever the first feature happens to do.

## Requirements

### Requirement: The workspace layout is fixed

The repository SHALL contain a pnpm workspace with two applications and five
shared packages, and every workspace member SHALL be covered by the root
verification commands.

#### Scenario: The repository structure is inspected

- **WHEN** the workspace members are listed
- **THEN** they SHALL be `apps/web`, `apps/extension`, and the packages `core`,
  `providers`, `mail-parser`, `storage`, and `ui`
- **AND** no other top-level directory SHALL be a workspace member

#### Scenario: A new package is added later

- **WHEN** a milestone requires a sixth shared package
- **THEN** it SHALL be placed under `packages/`
- **AND** it SHALL be picked up by type checking, linting, and tests without
  editing the root configuration to name it individually

### Requirement: Shared packages never depend on the applications

A package under `packages/` SHALL NOT import from `apps/web` or
`apps/extension`, in any module form, at any depth.

#### Scenario: Shared logic is needed by both clients

- **WHEN** behaviour is required by both the website and the extension
- **THEN** it SHALL be implemented in a package under `packages/`
- **AND** it SHALL NOT be implemented in an app and imported by the other app

#### Scenario: A package imports an app

- **THEN** the type check or the boundary test SHALL fail
- **AND** the violation SHALL name the offending file

### Requirement: Provider-specific code lives only in the provider package

Provider wire format and provider adapter logic SHALL be confined to
`packages/providers`. No file outside that package SHALL reference a provider
adapter, and no file under `apps/` SHALL contain a provider JSON field name.

#### Scenario: A component needs provider data

- **WHEN** a component under `apps/` needs a value that originates from a
  provider response
- **THEN** it SHALL receive it through a normalized domain type
- **AND** it SHALL NOT read, name, or branch on the provider's field name

#### Scenario: Provider logic is added outside the provider package

- **WHEN** a file outside `packages/providers` references a provider adapter
  identifier
- **THEN** the boundary test SHALL fail and name the file and line

#### Scenario: The boundary check matches a coincidental name

- **GIVEN** a file under `apps/` uses an identifier that coincides with a
  measured provider field name
- **THEN** the check SHALL report the file and line
- **AND** the resolution SHALL be to rename the local identifier, not to widen
  the exclusion

### Requirement: The measurement harness is not reachable from product code

The M0 provider spike SHALL remain outside the pnpm workspace. No application or
package SHALL be able to import it.

#### Scenario: Product code attempts to import the spike

- **WHEN** any workspace member imports from `tests/provider-spike`
- **THEN** it SHALL fail to resolve, because the spike is not a workspace member
- **AND** no build configuration SHALL alias it into the product dependency graph

#### Scenario: The spike is run

- **WHEN** a maintainer needs to re-measure provider behaviour
- **THEN** the spike SHALL still run from its own directory with its own lockfile
- **AND** the root verification commands SHALL NOT execute it

#### Scenario: The spike is retired

- **WHEN** real provider adapters replace the spike's purpose
- **THEN** its removal SHALL be a separate, explicit change
- **AND** it SHALL NOT be removed as incidental cleanup

### Requirement: The foundation contains no product behaviour

Milestone M1 SHALL create containers, tooling, and boundary enforcement only. It
SHALL NOT implement mailbox lifecycle, provider adapters, message parsing,
storage, or product UI.

#### Scenario: A package placeholder is inspected

- **WHEN** a shared package created at M1 is read
- **THEN** it SHALL contain no runtime behaviour
- **AND** it SHALL state in its own source that M1 creates no behaviour
- **AND** it SHALL NOT export a placeholder function that throws

#### Scenario: Filling in a stub is tempting

- **GIVEN** a package has no exports and a milestone needs some
- **THEN** the milestone that owns the behaviour SHALL add them
- **AND** M1 SHALL NOT pre-empt it with a stub