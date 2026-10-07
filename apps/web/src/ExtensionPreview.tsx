/**
 * The extension popup, described.
 *
 * ## What this region is
 *
 * The roadmap's fourth section, and the last one this milestone owes. It exists because
 * `apps/extension` now holds a real MV3 manifest, a service worker and a popup - while the
 * page said nothing about them, which made the page understate a product that exists.
 *
 * ## The one rule this component is shaped by: nothing here acts
 *
 * **The depiction renders no interactive element at all.** Not a `<button>`, not an `<a>`, not
 * an `<input>`, not `role="button"`, and not a disabled version of any of them. That is the
 * whole reason this is a `<figure>` and not a mini popup: a `Copy address` button inside a
 * picture of a popup would be a control on the page that does nothing when pressed, which is
 * the same defect `extension-client` removed from the popup itself - a control reporting an
 * action the product cannot take.
 *
 * **`design.md` D2 records why a disabled control is not the compromise.** It reads as the
 * better decision, and it is not: `disabled` says "this cannot act right now", and what is true
 * here is "this is not a control at all". The browser tier reads Chromium's own accessibility
 * tree over CDP for this, rather than counting `button` elements, because a role query is the
 * instrument that already lied to this repository once - Testing Library maps `footer` to
 * `contentinfo` unconditionally, and a shipped `<footer>` inside `<main>` passed the client
 * suite while Chromium reported zero `contentinfo` landmarks.
 *
 * ## Labels are data, and the boundary rule is what keeps them honest
 *
 * Every string below is a declared `label` in `sections.ts`, paired with the popup copy entry it
 * must equal. Nothing is typed here, so this component cannot disagree with the popup - and the
 * assertion that the declared `label` really is what the popup renders lives in
 * `tests/architecture/boundaries.test.ts`, which is the only place in the repository that reads
 * both clients' data. See `design.md` D3 for why the website holds the string rather than
 * importing the popup's.
 *
 * ## It names no provider, and this component's own note is why that is deliberate
 *
 * `sections.spec.ts` requires this page to name no provider but the one it can reach. Which
 * provider answers first inside the extension is a resilience detail, and naming it on a page
 * that reaches exactly one provider would invite a reader to compare two things that are not
 * comparable. The depicted regions are chosen so none of them requires one: the popup's address
 * region is *named in prose* rather than drawn, because its heading is a provider name and its
 * content is an address this page would have to invent.
 *
 * @module
 */

import { EXTENSION_PREVIEW } from "./sections";

export function ExtensionPreview() {
  return (
    <section className="region" aria-labelledby="extension-heading" data-region="extension">
      <h2 id="extension-heading">{EXTENSION_PREVIEW.heading}</h2>
      <p>{EXTENSION_PREVIEW.lede}</p>

      {/* **A `<figure>`, and that element choice is the requirement.** `figure` is what
        announces the content as a depiction, so a reader is told this is a picture of the
        popup rather than the popup. `aria-hidden` would have been the alternative and it is
        worse twice over: it would hide the labels a screen-reader user is entitled to, and it
        would achieve the non-interactivity by concealment rather than by the markup actually
        not containing anything operable. */}
      <figure className="preview">
        <figcaption className="preview__caption">{EXTENSION_PREVIEW.caption}</figcaption>

        <ol className="preview__regions">
          {EXTENSION_PREVIEW.regions.map((region) => (
            <li className="preview__region" key={region.does}>
              <p className="preview__does">{region.does}</p>
              <ul className="preview__labels">
                {region.labels.map((entry) => (
                  // **A list item, never a button.** This is the line the whole component
                  // is built to keep, and it is why the depiction is `<li>` text: the popup's
                  // own `Copy address` control becomes a line of prose about a control,
                  // rather than a control that lies.
                  <li className="preview__label" key={entry.key}>
                    {entry.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </figure>

      {/* **The one sentence about obtaining it, and it states no future.** There is no
        release workflow, no store listing and no signed artifact in this repository, so there
        is nothing a link could resolve to and no download control to place. `design.md` D5
        records why the sentence is here rather than the section saying nothing at all: a
        region that previews an extension and never mentions how one obtains it reads as an
        oversight, and an undescribed absence is what the next change touching this file fills
        in with whatever it happens to assume. It also names no milestone, because "soon" on a
        page is `page-composition`'s forbidden framing. */}
      <p className="preview__note">{EXTENSION_PREVIEW.note}</p>
    </section>
  );
}
