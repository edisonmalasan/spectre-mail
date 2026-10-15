# Spec Delta

## ADDED Requirements

### Requirement: A shipped branding review names every surface the public name reaches, and says which of its checks it could not measure

A document that publishes the result of a branding review SHALL name every shipped surface
the public name reaches, and SHALL state for each check it reports whether the check was
measured, by what instrument, and with what control that instrument was shown to work. A
check that produced no measurement SHALL be recorded as unmeasured and SHALL NOT be
reported as a clear result.

**This requirement exists because the review's verdict is only as good as the evidence
under it, and both halves of that are checkable.** The roadmap's branding item has never
been run, so there was no document and no evidence; the review that runs it is shipped
with both.

**The surface list is the part that can be checked against the tree, and it is checked in
both directions.** Every surface the review names must exist and render the one public
name, and every place the shipped tree names the product as the product must be in the
review's list. This is the shape `privacy-disclosure` already requires of what a device
keeps, and it is what stops a document from being right about the surfaces it happened to
mention.

**The external checks cannot be checked against the tree at all, and the requirement says
so rather than pretending otherwise.** A registry's answer about a domain, a store's
answer about an extension and a trademark register's answer about a mark are measurements
of the world on a date. **No test in this repository can re-run them, and an instrument
that claimed to would be a check that could not fail.** They are therefore carried in
prose, each with its instrument and its control.

**A control is not decoration; it is what decides whether a reported zero is a finding.**
A reader whose control query did not resolve is a reader that cannot distinguish "nothing
is there" from "I found nothing", and a zero from such a reader is the absence of a
measurement. **This repository has recorded a check reporting a collection failure as
green, a rate reader reporting nothing as measured, and a mutation that did not apply
passing a comparison it never performed** — every one of them a zero produced by a reader
rather than by the thing measured. **The review SHALL therefore state, for each check,
whether its control resolved, and SHALL report a check with an unresolved control as
unmeasured.**

#### Scenario: The review is checked against the tree

- **WHEN** the review's surface list is compared with the shipped tree
- **THEN** every surface it names SHALL exist and SHALL render the exported public name
- **AND** every place the tree names the product as the product SHALL appear in the
  review's list
- **AND** a disagreement in either direction SHALL be reported by name

#### Scenario: A check's control did not resolve

- **WHEN** the review reports a check whose control query produced no readable result
- **THEN** that check SHALL be recorded as unmeasured
- **AND** it SHALL NOT be reported as a clear result or as a passed check

#### Scenario: The review's verdict is read

- **WHEN** the review states the outcome of the branding review
- **THEN** it SHALL carry the date the measurements were taken
- **AND** it SHALL state which checks were not measured and why they could not be

#### Scenario: A measurement is quoted from a source

- **WHEN** the review reports what a registry, a store or a directory said
- **THEN** it SHALL name the instrument that asked and the control that proved the
  instrument worked
- **AND** a figure taken from a secondary summary SHALL be attributed to that summary
  rather than presented as a measurement