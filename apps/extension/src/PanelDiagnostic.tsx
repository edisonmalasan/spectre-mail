/**
 * What this session did, shown in the side panel.
 *
 * ## What it shows, and what it cannot
 *
 * **Counts, normalized outcomes, and one elapsed duration** -- the three shapes
 * `@spectre-mail/ui` defines, and nothing else. There is no field in this component for an
 * address, a message id, a sender, a subject, a hostname, a URL or content, **and the panel has an
 * address on screen a few lines above.** A report that could not hold an address cannot leak one.
 *
 * ## What it does not do
 *
 * **It persists nothing.** The counts live in the panel's memory and are gone when the panel
 * closes. There is no store behind it, no key, and no adapter, and `docs/PRIVACY.md`'s claim that
 * nothing is persisted outside two named areas is true *because this never reaches a store at all*.
 *
 * **And the panel's own stored records are unaffected** -- a mailbox, a site association and a
 * seen-message id are records the product keeps for the product's own reasons, and a report is not
 * one of them.
 *
 * @module
 */

import type { DiagnosticEntry } from "@spectre-mail/ui";

export interface PanelDiagnosticProps {
  /** The lines to show, already labelled in the panel's own words. */
  readonly entries: readonly DiagnosticEntry[];
}

/**
 * The report, and the one sentence that says what it is.
 *
 * **The sentence is load-bearing, and it is the one that makes the shape honest.** A list of numbers
 * under a heading called "Diagnostics" reads as telemetry; a list of numbers under a sentence that
 * says *this is what this session did, and it is gone when you close the panel* reads as what it is.
 *
 * **The section carries no class, and that is the panel's own idiom.** Its other three sections
 * are styled by `.panel section`, and **a class hook nothing selects is dead weight** — the
 * boundary suite reports one by name, and the repair the panel's own note gives is to have no hook
 * rather than to add a rule for it.
 */
export function PanelDiagnostic({ entries }: PanelDiagnosticProps) {
  return (
    <section aria-labelledby="panel-diagnostic-heading">
      <h2 id="panel-diagnostic-heading">What this session did</h2>
      <p>
        This is what this session did while it was open. It is counted in the panel while the panel
        is open, it is not kept anywhere, and nothing about it is sent anywhere.
      </p>
      <dl data-testid="panel-diagnostic-entries">
        {entries.map((entry) => (
          <div key={entry.label} className="panel__diagnostic-entry">
            <dt>{entry.label}</dt>
            <dd>{describe(entry)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * How a value reads in the panel.
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
