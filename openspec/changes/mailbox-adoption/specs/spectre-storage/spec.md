# Spec Delta

## ADDED Requirements

### Requirement: The platform storage API is named only inside this layer

The storage layer SHALL provide the way a browser client obtains a working
storage implementation, and that entry point SHALL read the platform's own storage
API from inside this layer. No client and no shared package SHALL name a platform
storage API. Where the platform does not provide one, this layer SHALL report that
rather than substitute a different store or proceed without persistence.

**Note, recorded during proposal.** The existing requirement already says no client
may name a platform storage API, and this change is the first thing that would
make a client want to. The website's adapter needs a real `IDBFactory`, and
`createIndexedDbStorage` deliberately has no global default — its design recorded
that a default reaching for a platform timer or store is a path that compiles
happily and only runs in production.

So the tension was real: either the client names `indexedDB` and the requirement
becomes false, or the requirement is quietly weakened to "no *shared* package". The
second option was rejected because it would leave the client free to reach for a
different store the moment one was inconvenient. The resolution is a second entry
point that names the platform API in the one layer allowed to, which leaves both
the requirement and the injected-adapter rule exactly as they were.

#### Scenario: A browser client builds its storage

- **WHEN** a browser client asks this layer for a storage implementation
- **THEN** this layer SHALL supply one without the client naming a storage API
- **AND** the client's own sources SHALL contain no platform storage API

#### Scenario: The platform provides no storage

- **WHEN** a client asks for a storage implementation where the platform provides
      none
- **THEN** this layer SHALL report that storage is unavailable
- **AND** it SHALL NOT return an implementation that stores nothing

#### Scenario: The browser entry point is exercised

- **WHEN** the storage implementation for a browser is verified
- **THEN** it SHALL be exercised by the default verification gate
- **AND** that exercise SHALL NOT require a real browser