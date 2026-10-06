/**
 * The wordmark, with the brand mark beside it.
 *
 * ## Why this is an inline `<svg>` and not an asset
 *
 * Three delivery routes were rejected, and the reason is recorded in `sections.ts`'s
 * `BRAND_MARK_PATH` note: a webfont breaks `visual-system`'s no-third-party-asset
 * requirement, an image request gives the browser tier's route handler an origin the page
 * does not have a recorded response for, and a raster file is a binary for a shape that is
 * four path commands.
 *
 * So the mark is drawn here, by the product, with no request at all. The path is data in
 * `sections.ts` beside the note explaining the decision.
 *
 * ## Why it is `aria-hidden`
 *
 * **The mark is decoration and the wordmark is the name.** The `<h1>` already says
 * "SpectreMail"; an image beside it that a screen reader announced again would be a name
 * read twice. `visual-system` requires state to be carried by words rather than by styling or
 * shape, and an unlabelled glyph is shape doing a name's job.
 *
 * @module
 */

import { BRAND_MARK_PATH } from "./sections";

export function Wordmark() {
  return (
    <div className="wordmark">
      {/* Decorative: the heading beside it is the accessible name. */}
      <svg
        aria-hidden="true"
        className="wordmark__mark"
        viewBox="0 0 20 16"
        focusable="false"
        role="presentation"
      >
        <path d={BRAND_MARK_PATH} fill="currentColor" />
      </svg>
      {/* `id` because the product's `<section>` is named by this heading. `page-composition`
          requires every region to be reachable by its own accessible name, and a
          `<section>` takes its name from its heading — so the product region is "SpectreMail",
          which is what it is. */}
      <h1 id="product-heading">SpectreMail</h1>
    </div>
  );
}
