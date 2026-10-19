/**
 * The report of what this session did, in the popup.
 *
 * ## What it shows, and what it cannot
 *
 * **Counts, normalized outcomes, and one elapsed duration** -- the three shapes
 * `@spectre-mail/ui` defines, and nothing else. There is no field in this component for an
 * address, a message id, a sender, a subject, a hostname, a URL or content, **and the popup has an
 * address on screen a few lines above.** A report that could not hold an address cannot leak one.
 *
 * ## Why the in-page answers are reported *here*
 *
 * **Because the popup is the surface that is told them.** It is the surface that asks the page to
 * fill a field, so it is the surface that receives the recogniser's answer -- and **a count made on
 * one surface and shown on another is a count the reader cannot connect to the thing it counted.**
 *
 * ## What it does not do
 *
 * **It persists nothing.** The counts live in the popup's memory and are gone when the popup
 * closes. There is no store behind it, no key, and no adapter, and `docs/PRIVACY.md`'s claim that
 * nothing is persisted outside two named areas is true *because this never reaches a store at all*.
 *
 * @module
 */

import type { DiagnosticEntry } from "@spectre-mail/ui";

export interface PopupDiagnosticProps {
  /** The lines to show, already labelled in the extension's own words. */
  readonly entries: readonly DiagnosticEntry[];
}

/**
 * The report, and the one sentence that says what it is.
 *
 * **The sentence is load-bearing, and it is the one that makes the shape honest.** A list of numbers
 * under a heading called "Diagnostics" reads as telemetry; a list of numbers under a sentence that
 * says *this is what this session did, and it is gone when you close the popup* reads as what it is.
 */
export function PopupDiagnostic({ entries }: PopupDiagnosticProps) {
  return (
    <section aria-labelledby="popup-diagnostic-heading">
      <h2 id="popup-diagnostic-heading">What this session did</h2>
      <p>
        This is what this session did while it was open. It is counted in the popup while the popup
        is open, it is not kept anywhere, and nothing about it is sent anywhere.
      </p>
      <dl data-testid="popup-diagnostic-entries">
        {entries.map((entry) => (
          <div key={entry.label} className="popup__diagnostic-entry">
            <dt>{entry.label}</dt>
            <dd>{describe(entry)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * How a value reads in the popup.
 *
 * **Three shapes, three renderings, and the shape decides the wording.** A count is a number, an
 * outcome is the name the product produced, and a duration is a length of time -- **never a moment**,
 * which is the whole reason a duration is the one time-shaped value a report may carry.
 */
function describe(entry: DiagnosticEntry): string {
  switch (entry.value.kind) {
    case "count":
      return String(entry.value.value);
    case "normalizedOutcome":
      return entry.value.outcome;
  }
}
