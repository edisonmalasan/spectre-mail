/**
 * What this session did, shown to the person using the page.
 *
 * ## Why this is a region of its own inside the product region, and not a sixth region
 *
 * **`page-composition` forbids a sixth region**, and the surface immediately beside this one shows
 * how the repository answers that: `LocalData` is a `<section>` with its own heading **inside** the
 * product region, and it is not one of the page's five regions. Its own note gives the reason, and
 * the reason is the one this surface needs:
 *
 * > *"It renders in **every session state** once the boot is done, because **what this browser
 * > remembers has nothing to do with what the session is doing** — a user looking at a creation
 * > failure with a stored address still needs to remove it."*
 *
 * **A report of what the session did is exactly that.** A person whose address could not be
 * created still has a report to read, and so does a person whose inbox could not be listed.
 *
 * ## What it shows, and what it cannot
 *
 * **Counts, normalized outcomes, and one elapsed duration** — the three shapes
 * `@spectre-mail/ui` defines, and nothing else. There is no field in this component for an
 * address, a message id, a sender, a subject, a hostname, a URL or content, **and the page has an
 * address on screen two hundred pixels away.** A report that could not hold an address cannot leak
 * one.
 *
 * ## What it does not do
 *
 * **It persists nothing.** The counts live in the page's memory and are gone when the tab closes.
 * There is no store behind it, no key, and no adapter, and `docs/PRIVACY.md`'s claim that nothing
 * is persisted outside two named areas is true *because this never reaches a store at all*.
 *
 * @module
 */

import type { DiagnosticEntry } from "@spectre-mail/ui";

import type { SessionDiagnostic } from "./session-diagnostic";

export interface DiagnosticProps {
  /** What this session has done so far. */
  readonly diagnostic: SessionDiagnostic;
  /** The lines to show, already labelled in the page's own words. */
  readonly entries: readonly DiagnosticEntry[];
}

/**
 * The report, and the one sentence that says what it is.
 *
 * **The sentence is load-bearing, and it is the one that makes the shape honest.** A list of numbers
 * under a heading called "Diagnostics" reads as telemetry; a list of numbers under a sentence that
 * says *this is what this session did, and it is gone when you close the page* reads as what it is.
 */
export function Diagnostic({ entries }: DiagnosticProps) {
  return (
    <section className="region" aria-labelledby="diagnostic-heading">
      <h2 id="diagnostic-heading">What this session did</h2>
      <p>
        This is what this session did while it was open. It is counted in the page while the page is
        open, it is not kept anywhere, and nothing about it is sent anywhere.
      </p>
      <dl data-testid="diagnostic-entries">
        {entries.map((entry) => (
          <div key={entry.label} className="diagnostic__entry">
            <dt>{entry.label}</dt>
            <dd>{describe(entry)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * How a value reads on the page.
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
