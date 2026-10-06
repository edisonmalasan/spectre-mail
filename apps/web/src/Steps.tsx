/**
 * The three steps the page performs, as a region.
 *
 * **A list, not three cards.** The approved direction asks for thin or precise borders
 * instead of heavy depth effects, and the design rules name the rounded-card-everything
 * pattern as the thing to avoid. Three numbers on a shared baseline, separated by the
 * existing hairline vocabulary, carries the same Swiss structure without three containers.
 *
 * @module
 */

import { STEPS } from "./sections";

export function Steps() {
  /**
   * **`region` alone, and the variant hook this carried first is gone.**
   *
   * It read `region section--steps` with nothing in `styles.css` matching `section--steps`,
   * and the boundary rule *"uses every class hook a client renders"* caught it: two hooks
   * invented so two sibling sections would look symmetric in markup, with no rule behind
   * either. **A class that styles nothing is not a hook, it is a comment** — and `data-region`
   * is the hook this section is actually identified by.
   */
  return (
    <section className="region" aria-labelledby="steps-heading" data-region="steps">
      <h2 id="steps-heading">What happens, in order</h2>
      <ol className="steps">
        {STEPS.map((step) => (
          <li className="steps__item" key={step.name}>
            <h3 className="steps__name">{step.name}</h3>
            <p className="steps__does">{step.does}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
