/**
 * Every sentence the extension popup can say, as data.
 *
 * ## Why this is its own module
 *
 * **Because the website depicts this popup, and a depiction cannot be kept honest by review.**
 *
 * The website's `Extension preview` region names the regions and controls this popup renders.
 * Those names were written down here first, as a module-private constant, and a constant nobody
 * outside this file can read is a constant the website cannot derive its depiction from. So the
 * copy is exported, and a boundary assertion in `tests/architecture/boundaries.test.ts` resolves
 * every name the website's section declares against **this** object.
 *
 * That assertion is the whole point of the export. Without it, the website's depiction is a
 * hand-maintained copy that is correct on the day it is written and silently wrong after the
 * next change here — and a wrong depiction is worse than none, because a visitor reading it
 * learns something false about a product that does exist.
 *
 * ## Data rather than inline strings
 *
 * For the reason `apps/web/src/sections.ts` gives: a claim is reviewable beside the requirement
 * it satisfies, and a test can read what the product says without scraping rendered text for it.
 *
 * @module
 */

/** Every sentence the popup can say. */
export const POPUP_COPY = {
  booting: "Reading what this device saved",
  /** **Shown instead of a create action when the read failed.** */
  bootFailed: "SpectreMail could not read its own storage, so it will not create an address.",
  create: "Create an address",
  creating: "Asking for an address",
  /**
   * **The one template in this object.**
   *
   * It is resolved against a live provider name before it is rendered, so it cannot be
   * depicted as written — a preview printing `"Asking {provider} first"` would put a
   * substitution token on a marketing page. {@link POPUP_COPY_TEMPLATES} declares this
   * rather than leaving a reader to find it by searching for a brace.
   */
  reaching: "Asking {provider} first",
  copy: "Copy address",
  copied: "Copied.",
  copyFailed: "The clipboard refused. Select the address and copy it by hand.",
  status: "Provider status",
  askStatus: "Check provider",
  unknown: "Not asked yet",
  inbox: "Inbox",
  check: "Check for mail",
  checking: "Checking",
  empty: "No mail has arrived.",
  /**
   * **A function of the count, and it has to be one.**
   *
   * It used to be `` `${COPY.checkFailed} ${COPY.count(n)}` `` — two adjacent expressions,
   * which is two text nodes. That renders identically and made the failure unreachable by any
   * text matcher: Testing Library reported the text "could be broken up by multiple elements"
   * and the element it printed was the *whole* popup. An assertion that cannot address what it
   * is about is not an assertion, so the sentence became a function of the count.
   *
   * **It is a function for the same reason the export matters**: a depiction can only show a
   * string, so a function-valued entry is one no depiction may claim to render.
   */
  count: (n: number): string => `${n} message${n === 1 ? "" : "s"}`,
  checkFailed: (n: number): string =>
    `The last check failed. The count below is the last one that succeeded: ${n} message${n === 1 ? "" : "s"}.`,
  /** **A stored mailbox the provider no longer honours is `expired`, not empty.** */
  expired: "This address no longer receives mail.",
} as const;

/**
 * The entries carrying a substitution token.
 *
 * **Declared rather than discovered, because a discovered one is not a check.** A rule that
 * scans for a brace and exempts what it finds enforces nothing — it agrees with every input,
 * including a new template added next month. Declaring the list means a *second* token fails,
 * which is the only direction in which this can fail.
 */
export const POPUP_COPY_TEMPLATES: readonly string[] = ["reaching"];

/** Every entry name, for a caller that resolves names rather than holding them. */
export const POPUP_COPY_KEYS = Object.keys(POPUP_COPY);