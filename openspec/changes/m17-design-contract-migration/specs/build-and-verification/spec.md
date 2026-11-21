# build-and-verification

## ADDED Requirements

### Requirement: Full-page visual comparison is a recorded verification step

The repository SHALL document and be able to run a matched-viewport, full-page comparison of
the built website against the dated M16 reference captures. The comparison SHALL mask only
dynamic address and timestamp values, SHALL record capture metadata, and SHALL name every
intentional deviation. A passing unit suite SHALL NOT be reported as satisfying this step.

#### Scenario: The visual comparison is performed

- **WHEN** the verification plan names the full-page comparison step
- **THEN** reference and local full-page artifacts SHALL exist for every declared viewport
- **AND** the recorded result SHALL name each deviation or state that none remain
