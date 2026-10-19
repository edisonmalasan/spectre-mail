/**
 * The website's report of what this session did.
 *
 * ## What this module is, and what it is not
 *
 * **The fold is not here.** It is in `@spectre-mail/mailbox`, beside the `SessionState` it reads,
 * because both clients fold the same function and a copy in each client is two implementations that
 * agree until the first edit. **What is here is the wording** -- the page's own labels -- and the
 * wrapping of the fold's numbers into the shapes `@spectre-mail/ui` defines.
 *
 * **The division is the point: the shape of a reportable value is shared, and the words are the
 * client saying it.** The extension says the same things in a different voice, and the two cannot
 * drift because the *values* they carry come from one definition.
 *
 * ## What it does not do
 *
 * **It persists nothing.** The counts live in the page's memory and are gone when the tab closes.
 * There is no store behind it, no key, and no adapter, and `docs/PRIVACY.md`'s claim that nothing
 * is persisted outside two named areas is true *because this never reaches a store at all*.
 *
 * @module
 */

import type { DiagnosticEntry, DiagnosticReport } from "@spectre-mail/ui";
import { reportableCount, reportableOutcome } from "@spectre-mail/ui";

import type { SessionDiagnostic } from "@spectre-mail/mailbox";

export type { SessionDiagnostic };

/**
 * The labels the website uses, so that a report reads in the page's own voice.
 *
 * **A label is the only free text in a report**, and these are the page's own sentences.
 */
export interface DiagnosticLabels {
  readonly created: string;
  readonly creationFailure: (code: string) => string;
  readonly creationFailureCount: (code: string) => string;
  readonly listings: string;
  readonly checksFailed: string;
  readonly detections: string;
}

/** The labels the website uses. */
export const WEBSITE_DIAGNOSTIC_LABELS: DiagnosticLabels = {
  created: "Addresses this session created",
  creationFailure: (code) => `The address could not be created (${code})`,
  creationFailureCount: (code) => `Times that happened (${code})`,
  listings: "Inbox listings this session received",
  checksFailed: "Inbox checks this session could not complete",
  detections: "Messages something was detected in",
};

/**
 * The report this session's diagnostic amounts to.
 *
 * **Every line is one of the three reportable shapes, and every label is the reporting client's own
 * words.**
 *
 * @param diagnostic - What the session has done.
 * @param labels - The words to say it in.
 * @returns The report to show.
 */
export function diagnosticReport(
  diagnostic: SessionDiagnostic,
  labels: DiagnosticLabels,
): DiagnosticReport {
  const entries: DiagnosticEntry[] = [];

  entries.push({ label: labels.created, value: reportableCount(diagnostic.created) });

  for (const [code, count] of Object.entries(diagnostic.creationFailures)) {
    entries.push({ label: labels.creationFailure(code), value: reportableOutcome(code) });
    entries.push({ label: labels.creationFailureCount(code), value: reportableCount(count) });
  }

  entries.push({ label: labels.listings, value: reportableCount(diagnostic.listings) });
  entries.push({ label: labels.checksFailed, value: reportableCount(diagnostic.checksFailed) });
  entries.push({ label: labels.detections, value: reportableCount(diagnostic.detections) });

  return { entries };
}
