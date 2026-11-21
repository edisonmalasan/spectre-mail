/**
 * The public information regions below the working product.
 *
 * M16 measured a Temp Mail page 4,281px tall with nine below-fold headings and a footer.
 * SpectreMail's product stays the first region; these sections occupy the read-on positions
 * the reference gives its information. Every sentence here is original SpectreMail copy that
 * preserves the informational role of a measured section — none of the reference's protected
 * prose is copied. No section offers a control that does nothing and no section claims a
 * capability, licence, provider or figure the product does not hold.
 *
 * @module
 */

/** The lead explainer: what a disposable address is and why SpectreMail offers one. */
export function ExplainerSection() {
  return (
    <section className="info-section" data-region="explainer" aria-labelledby="explainer-heading">
      <h1 id="explainer-heading">A temporary address for the moment you need one</h1>
      <p>
        SpectreMail gives you an address you can use for a signup, a download or a one-time
        verification, then leave behind. Incoming mail stays readable on this page while you are
        here; nothing is sent to a server that SpectreMail operates.
      </p>
      <p>
        A disposable address is useful when a service wants an email but does not need your
        permanent one. It keeps the messages you actually came for out of your everyday inbox and
        gives you a place to read a code or a link without handing over your real address.
      </p>
    </section>
  );
}

/**
 * A short, curated set of links to the public routes this product actually implements.
 *
 * Every entry is a real anchor to a route `routeFor()` resolves and the built site serves. The
 * old comment here said the routes would arrive in a future task; that stopped being true when the
 * nine informational articles shipped, so the entries are now links rather than inert text. A link
 * to a route the build does not have would be a control that does nothing, which the repository
 * forbids — the browser tier resolves each href before this claim is allowed to stand.
 */
export function ArticlesSection() {
  return (
    <section className="info-section" data-region="articles" aria-labelledby="articles-heading">
      <h2 id="articles-heading">Read more about temporary email</h2>
      <ul className="info-section__links">
        {/* The existing `.link__anchor` hook keeps these in the declared palette and gives
            them the same keyboard focus ring as every other link on the page. */}
        <li>
          <a className="link__anchor" href="/faq">
            Common questions about disposable addresses
          </a>
        </li>
        <li>
          <a className="link__anchor" href="/10minutemail">
            Why a short-lived address still has a place online
          </a>
        </li>
        <li>
          <a className="link__anchor" href="/email-generator">
            Getting an address without filling in a form
          </a>
        </li>
        <li>
          <a className="link__anchor" href="/change">
            How this product replaces an address
          </a>
        </li>
        <li>
          <a className="link__anchor" href="/privacy-policy">
            What this device keeps and what goes to a provider
          </a>
        </li>
        <li>
          <a className="link__anchor" href="/blog">
            Short notes about temporary email
          </a>
        </li>
      </ul>
    </section>
  );
}

/**
 * The long-form informational block corresponding to the reference's stacked explainer
 * headings. Original wording, same informational role: what it is, when to use it, how to
 * choose, how to read, and a short close.
 */
export function ReferenceSection({ address }: { readonly address: string | null }) {
  return (
    <section className="info-section" data-region="reference" aria-labelledby="reference-heading">
      <h2 id="reference-heading">How a temporary address fits into your day</h2>
      <h3>What it is</h3>
      <p>
        It is an address this device can hold for a short while, created by one of the providers
        SpectreMail reaches and checked through the same abstraction the extension uses. You read
        its messages here, and the address itself is always available to copy.
      </p>
      <h3>When it helps</h3>
      <p>
        Use one wherever a site asks for an email you will not need again: a trial, a forum, a
        download, or a verification you only have to complete once. The code or link you receive is
        detected on this page, and nothing is submitted on your behalf.
      </p>
      <h3>Choosing one</h3>
      <p>
        A working address is better than a long list of names. SpectreMail shows you the domains a
        reachable provider actually reports, and only offers one it can create a mailbox on. When no
        provider exposes a domain list from a browser page, automatic creation is the honest choice.
      </p>
      <h3>Reading and returning</h3>
      <p>
        Messages stay in the inbox while a check runs, and opening one does not remove the list. A
        change of address clears the previous mailbox's messages before the new one is shown.
        {address === null ? "" : " The address above is the one this page is reading."}
      </p>
    </section>
  );
}
