/**
 * Why a visitor might use this, as a region.
 *
 * **Each reason carries its own support sentence**, and that is the whole design. A list of
 * bare claims is a list of assertions; a claim followed by the sentence that makes it true is
 * a claim a reader can check against what they are about to do. The reasons are data in
 * `sections.ts`, each annotated with what in the repository substantiates it.
 *
 * @module
 */

import { REASONS } from "./sections";

export function Reasons() {
  return (
    <section
      // **`region` alone, for the reason `Steps.tsx` records.** The `section--reasons`
      // variant hook had no rule behind it, and `data-region` is the hook this section is
      // identified by.
      className="region"
      aria-labelledby="reasons-heading"
      data-region="reasons"
    >
      <h2 id="reasons-heading">Why SpectreMail</h2>
      <dl className="reasons">
        {REASONS.map((reason) => (
          <div className="reasons__pair" key={reason.claim}>
            <dt className="reasons__claim">{reason.claim}</dt>
            <dd className="reasons__support">{reason.support}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
