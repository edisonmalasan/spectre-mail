/**
 * Renders one public informational route in the same shell as the product page.
 *
 * The working product is not mounted on these paths: a visitor reading the FAQ has no reason
 * for the session layer to create an address. The header and footer are shared so the pages read
 * as one product, and every section is original SpectreMail copy from `public-routes.ts`.
 *
 * @module
 */

import { AppHeader } from "./AppHeader";
import { PublicFooter } from "./PublicFooter";
import { PUBLIC_ROUTES, type PublicRoute } from "./public-routes";

export function routeFor(path: string): PublicRoute | null {
  return PUBLIC_ROUTES.find((route) => route.path === path) ?? null;
}

export function PublicRoutePage({ route }: { readonly route: PublicRoute }) {
  return (
    <>
      <main className="page">
        <AppHeader />
        <article className="public-route" aria-labelledby="public-route-heading">
          <h1 id="public-route-heading">{route.title}</h1>
          <p className="public-route__intro">{route.intro}</p>
          {route.sections.map((section) => (
            <section key={section.heading} className="public-route__section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </main>
      {/* contentinfo is a page landmark; inside <main> Chromium reports sectionfooter with no
          contentinfo at all. It must be a sibling, as on the home page. */}
      <PublicFooter />
    </>
  );
}
