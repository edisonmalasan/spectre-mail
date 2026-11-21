/**
 * The public footer: truthful limits, attribution and the informational roles the M16
 * reference's footer carries. External/premium/app destinations are NOT rendered as
 * controls this build cannot honour — an unavailable link is a control that does nothing.
 * All copy is original SpectreMail text; no licence or independent-server claim is made.
 *
 * @module
 */

export function PublicFooter() {
  return (
    <footer className="page-footer" data-region="footer" aria-labelledby="footer-heading">
      <h2 id="footer-heading">What this page can and cannot do</h2>
      <nav className="page-footer__nav" aria-label="About SpectreMail">
        <span>About temporary addresses</span>
        <span>Common questions</span>
        <span>Privacy</span>
        <span>Terms</span>
        <span>Contact</span>
      </nav>
      <p>
        SpectreMail reaches the providers this build supports and operates no mail server of its
        own. It keeps this device&apos;s address in this browser, copies an address or a detected
        code only when you ask, and opens a detected link only when you ask. No backend receives
        your mail.
      </p>
      <p className="page-footer__note">
        Some destinations the reference lists belong to premium accounts, mobile apps or outside
        services; they are named here as information only and are not offered as controls on this
        page.
      </p>
    </footer>
  );
}
