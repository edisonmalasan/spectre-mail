/**
 * The page's section copy, as data rather than as markup.
 *
 * ## Why copy lives here and not in JSX
 *
 * Every sentence in this file is a **claim about the product**, and the whole discipline of
 * this page is that a claim is traceable to something the repository holds. Copy embedded in
 * markup can only be reviewed by reading markup; copy held as data can be read top to bottom
 * in one place, beside the note naming what substantiates it.
 *
 * That is not tidiness. `App.tsx`'s own header is a list of what the page states and why,
 * and this file is the continuation of that list for the copy a visitor actually reads.
 *
 * ## The rule every entry below obeys
 *
 * A sentence here describes **behaviour the product has today**. Not behaviour it has
 * announced, not behaviour a roadmap names, not behaviour a visitor might reasonably hope
 * for. Where the roadmap's own wording would overstate the product, the wording is narrowed
 * here and the narrowing is recorded beside it.
 *
 * @module
 */

/** One step of the page's own sequence. */
export interface Step {
  /** The word used for the step in prose and in the heading. */
  readonly name: string;
  /** What the product does at this step, in one sentence. */
  readonly does: string;
}

/**
 * The three steps, in the order the page performs them.
 *
 * **The third step is *not* "delete the message", and that narrowing is the reason this list
 * is written down.** The roadmap names the sequence `Generate → Receive → Discard`, and a
 * reader would take "discard" as discarding mail. SpectreMail cannot delete a message: the
 * provider owns it, and no control anywhere in this product removes one. What the product
 * *does* offer is two things — replacing the address, and making this browser forget it — and
 * both are controls on the page. So the step names those, and the page claims nothing about
 * mail it cannot remove.
 */
export const STEPS: readonly Step[] = [
  {
    name: "Generate",
    // Basis: `website-client` — "The website creates a mailbox without asking", and the
    // page does it on load rather than behind a button.
    does: "You get an address the moment the page opens. Nothing is required of you first.",
  },
  {
    name: "Receive",
    // Basis: `mailbox-session` polling, and the inbox region the page renders.
    does: "The address is checked while you have the page open, and what arrives is listed.",
  },
  {
    name: "Discard",
    // Basis: the `Replace address` control, and `spectre-storage`'s removal. Neither removes
    // a message, and this sentence must not read as though one of them does.
    does: "You can put the address aside when you are finished with it, and make this browser forget it.",
  },
];

/** One reason a visitor might use this. */
export interface Reason {
  /** The reason, as a short phrase. */
  readonly claim: string;
  /** Why it holds, in one sentence. */
  readonly support: string;
}

/**
 * The reasons the page makes.
 *
 * **Each one is checkable against something this repository holds**, and the basis is named
 * beside it so a reader can disagree with the claim without hunting for the evidence:
 *
 * - *No account.* The page creates an address on load with no form on the way — the whole of
 *   `provider-config.ts` and `useMailboxSession`'s boot, with no credential step.
 * - *No server.* An architecture rule, not a feature: SpectreMail operates no backend and
 *   never relays a provider request, so there is nothing between the visitor and the provider
 *   but the provider.
 * - *Your address stays here.* `spectre-storage` stores one mailbox in this browser's own
 *   storage, and `LocalData` offers a confirmed removal of the whole database.
 * - *One provider, and it is named.* The website reaches Guerrilla Mail and no other, for the
 *   measured CORS reason in `provider-config.ts`. **This is a limitation stated as a fact
 *   rather than hidden** — the roadmap's Direction asks for restraint, and a product that
 *   claimed redundancy it does not have would be the loudest false claim available.
 *
 * **No licence claim appears here or anywhere on this page.** The roadmap's fifth section is
 * a *Privacy/providers/**open-source** footer*, and the repository carries no `LICENSE` file
 * and GitHub reports `licenseInfo: null`. See `design.md` D3: the item is audited away rather
 * than satisfied by a claim the page cannot support.
 */
export const REASONS: readonly Reason[] = [
  {
    claim: "No account",
    support: "There is no sign-up, no password, and no profile. The address exists on its own.",
  },
  {
    claim: "No server in the middle",
    support: "SpectreMail runs no backend of its own and never relays a provider request.",
  },
  {
    claim: "The address stays in this browser",
    support:
      "It is written to this device's own storage, and one control makes the browser forget it.",
  },
  {
    claim: "One provider, named",
    support:
      "The page reaches Guerrilla Mail and nothing else, which is what a web page can reach.",
  },
];

/**
 * What the page can and cannot do.
 *
 * **These four sentences are not new copy.** They are the existing limits list, moved from
 * the middle of the page to the footer unchanged — `website-client`'s delta requires them to
 * travel with their content intact, because each is a measurement or a promoted requirement
 * rather than a summary:
 *
 * - the provider sentence is the measured CORS fact in `provider-config.ts`;
 * - the code-and-link sentence is `website-client`'s *"This slice shows what it found and does
 *   not act on it"*;
 * - the no-server sentence is the architecture rule against proxying a provider.
 *
 * **The storage sentence is deliberately not here.** What this device keeps is owned by
 * `LocalData`, which states it beside the control that removes it. A limit list that restates
 * a storage guarantee is the claim this page deleted once already — it stored an address and
 * said no button could take it back, which was true and then stopped being true. So the
 * footer points at the region instead of repeating it.
 */
export const LIMITS: readonly string[] = [
  "It reaches Guerrilla Mail and nothing else.",
  "It lists what is in the address, and marks mail that carries a code or a link.",
  "It can open a message and show its text, the codes it found, and the links it found.",
  "It does not copy codes or follow links for you. Those are the verification workflow, which this page does not do yet.",
  "No server is involved. SpectreMail operates no backend and never relays a provider request.",
];

/**
 * The page's regions, in the order it renders them.
 *
 * **The order is data so that it is a requirement that can be checked.** Two compositions with
 * the same four regions in a different order are different products, and the only way to
 * assert an order is to have it somewhere a reader — or a browser check — can see.
 *
 * **The product is first, and it is the product.** The roadmap's first section is *Live
 * product hero* and the roadmap then says *"The product itself should remain the main hero"*;
 * both hold here because the first entry **is** the working address rather than a description
 * of one. `design.md` D1 records the alternative that was rejected for this.
 *
 * **`Extension preview` is absent from this list, and that absence is specified** rather than
 * overlooked: `apps/extension` is an empty placeholder with no Manifest V3 manifest, so a
 * preview would depict nothing, and a panel promising one would be a promise the product has
 * not made. It is M7 slice 4's subject and slice 4 is blocked on M8.
 */
export const PAGE_ORDER = ["product", "steps", "reasons", "footer"] as const;

/** One region of the page, as the order names it. */
export type PageRegion = (typeof PAGE_ORDER)[number];

/**
 * The stable hook on each region.
 *
 * **Why this exists.** The browser tier has to read the page's *order* — the whole point of
 * `PAGE_ORDER` being data rather than markup — and the only way to do that without asserting
 * on CSS is to give each region a hook it can collect and compare. Visible text was tried and
 * rejected: a visitor reads "What happens, in order", and a test that reads the same words is
 * asserting that the heading exists, not that the region sits where it was put.
 *
 * **And why they are `data-region` rather than `data-testid`.** `data-testid` names a target
 * for a test; these name what a region *is*, and they are part of the page's contract with
 * `page-composition` rather than an implementation detail of a spec file. The existing
 * `data-testid`s on the product's own regions are untouched — the product's states are
 * asserted by them and this change renames nothing.
 */
export const REGION_HOOKS: Readonly<Record<PageRegion, string>> = {
  product: "product",
  steps: "steps",
  reasons: "reasons",
  footer: "footer",
};

/**
 * The brand mark.
 *
 * **Drawn inline, and that is a measured decision rather than a preference.** The direction
 * asks for "subtle geometric branding" with the accent, and three ways of delivering it were
 * rejected:
 *
 * - **a webfont or icon font** — `visual-system` requires the page to load no third-party
 *   asset, and this product's stated subject is what is kept on this device;
 * - **an SVG file under `public/`** — a same-origin request, so it would technically survive
 *   the no-third-party rule, but the browser tier's route handler aborts and *reports* any
 *   origin it has no recorded response for, and an asset fetch the page does not record is
 *   exactly what that handler exists to catch;
 * - **an image request of any kind** — same reasoning, plus a raster asset for a shape that is
 *   four lines of markup.
 *
 * So it is an inline `<svg>` the product renders itself. There is no request to record, and
 * nothing third-party to reach.
 */
export const BRAND_MARK_PATH = "M2 2 H10 V5 H5 V10 H2 Z M10 10 H14 V14 H10 Z M14 2 H18 V6 H14 Z";
