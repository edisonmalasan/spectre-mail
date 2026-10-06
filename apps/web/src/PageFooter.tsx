/**
 * The page's footer: what it reaches, and what it does not do.
 *
 * **The limits moved here unchanged.** They used to sit between the product and the end of
 * the page, where a list of things the product will not do read as an apology partway through.
 * As a footer the same four sentences read as a specification, which is what they are — each
 * one a measurement (`provider-config.ts`) or a promoted requirement rather than a summary.
 *
 * **No licence claim, and the omission is deliberate.** The roadmap names an
 * *open-source footer*; this repository carries no `LICENSE` file and GitHub reports
 * `licenseInfo: null`. The limits shipped are the ones that are true. See `design.md` D3 for
 * the alternatives that were offered and declined.
 *
 * @module
 */

import { LIMITS } from "./sections";

export function PageFooter() {
  return (
    <footer className="footer" aria-labelledby="limits-heading" data-region="footer">
      <h2 id="limits-heading" className="footer__heading">
        What this page can and cannot do
      </h2>
      <ul className="footer__limits">
        {LIMITS.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
      {/* **A pointer, not a restatement.** What this device keeps is owned by `LocalData`,
          which states it beside the control that removes it. A limit list that repeats a
          storage guarantee is the claim this page deleted once already. */}
      <p className="footer__note">
        What this browser keeps is written in the section above, next to the control that removes
        it.
      </p>
    </footer>
  );
}
