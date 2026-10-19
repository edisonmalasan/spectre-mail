/**
 * The extension's report of what this session did.
 *
 * ## What this module is, and what it is not
 *
 * **The fold is not here** -- it is in `@spectre-mail/mailbox`, beside the `SessionState` it reads,
 * because both clients fold the same function. **What is here is the wording** -- the extension's
 * own labels -- and the wrapping of the fold's numbers into the shapes `@spectre-mail/ui` defines.
 *
 * **And the in-page answers, because the extension has one thing the website does not.** The
 * recogniser answers with its own vocabulary -- a field was filled, no field was found, the field
 * already held text, the frame was not the top one -- and **that answer is exactly the "email-field
 * injection failures" the roadmap's beta goals ask for.** It is already produced, already
 * normalized, and **already says why**, which is the whole of what a failure count is worth.
 *
 * ## What it does not do
 *
 * **It persists nothing**, and **the extension's own stored records are unaffected** -- a mailbox, a
 * site association and a seen-message id are records the product keeps for the product's own
 * reasons, and a report is not one of them.
 *
 * @module
 */

import type { DiagnosticEntry, DiagnosticReport } from "@spectre-mail/ui";
import { reportableCount, reportableOutcome } from "@spectre-mail/ui";

import type { SessionDiagnostic } from "@spectre-mail/mailbox";

/**
 * The in-page answers this session has seen, counted.
 *
 * **The answer's own name and how many times.** The answer is a normalized outcome already, and
 * **nothing about the page it happened on is here** -- not its host, not its fields, not the
 * contents of anything.
 */
export interface InPageAnswers {
  /** How many times each answer was seen. */
  readonly counts: Readonly<Record<string, number>>;
}

/** No in-page answers yet. */
export function emptyInPageAnswers(): InPageAnswers {
  return { counts: {} };
}

/**
 * Fold one in-page answer into the tally.
 *
 * @param answers - What has been seen so far.
 * @param answer - The answer's own name, from the recogniser's closed vocabulary.
 * @returns The tally with that answer counted.
 */
export function observeInPageAnswer(answers: InPageAnswers, answer: string): InPageAnswers {
  return { counts: { ...answers.counts, [answer]: (answers.counts[answer] ?? 0) + 1 } };
}

/** The labels the extension uses, so that a report reads in the extension's own voice. */
export interface DiagnosticLabels {
  readonly created: string;
  readonly creationFailure: (code: string) => string;
  readonly creationFailureCount: (code: string) => string;
  readonly listings: string;
  readonly checksFailed: string;
  readonly detections: string;
  readonly inPageAnswer: (answer: string) => string;
  readonly inPageAnswerCount: (answer: string) => string;
}

/** The labels the extension uses. */
export const EXTENSION_DIAGNOSTIC_LABELS: DiagnosticLabels = {
  created: "Addresses this session created",
  creationFailure: (code) => `The address could not be created (${code})`,
  creationFailureCount: (code) => `Times that happened (${code})`,
  listings: "Inbox listings this session received",
  checksFailed: "Inbox checks this session could not complete",
  detections: "Messages something was detected in",
  inPageAnswer: (answer) => `What the page's field answered (${answer})`,
  inPageAnswerCount: (answer) => `Times that happened (${answer})`,
};

/**
 * The report this session's diagnostic and this session's in-page answers amount to.
 *
 * @param diagnostic - What the session has done.
 * @param answers - What the in-page recogniser has answered.
 * @param labels - The words to say it in.
 * @returns The report to show.
 */
export function diagnosticReport(
  diagnostic: SessionDiagnostic,
  answers: InPageAnswers,
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

  for (const [answer, count] of Object.entries(answers.counts)) {
    entries.push({ label: labels.inPageAnswer(answer), value: reportableOutcome(answer) });
    entries.push({ label: labels.inPageAnswerCount(answer), value: reportableCount(count) });
  }

  return { entries };
}
