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
 * One label the preview shows, held against the extension popup's copy.
 *
 * **`key` is the popup copy entry this label must equal, and `label` is what the page prints.**
 *
 * They are two fields rather than one because the website deliberately does **not** import the
 * popup's copy to render these. Importing would make `apps/web`'s build require
 * `apps/extension`'s source tree, which would be the first shipped-source dependency between the
 * two clients that this repository has; `design.md` D3 records the measurement. So the string is
 * held here and the *equality* is enforced, which fails the build in both directions: a popup
 * rename leaves `label` matching no popup entry, and a label invented here matches none either.
 */
export interface PreviewLabel {
  /** The `popup-copy.ts` entry whose value this label must equal. */
  readonly key: string;
  /** What the page prints. A boundary assertion requires this to equal `POPUP_COPY[key]`. */
  readonly label: string;
}

/** One region of the extension popup, as the preview describes it. */
export interface PreviewRegion {
  /** What the popup's region is for, in the page's own words. */
  readonly does: string;
  /** The popup copy entries this region renders, as labels. */
  readonly labels: readonly PreviewLabel[];
}

/**
 * The extension popup, described.
 *
 * ## What this section is, and what it deliberately is not
 *
 * `Extension preview` is the roadmap's fourth section and M7 slice 4's subject. It was **absent
 * by requirement** while `apps/extension` was an empty placeholder: a preview of something the
 * product has not built is a picture of a picture, and a panel promising one would be a promise
 * the product had not made. M8 built the extension, so the absence became the false claim and the
 * section is now required. The sentences of the old note that described the extension as unbuilt
 * are **deleted rather than reworded** — they became false when the manifest landed, and a
 * reworded version would read as current state.
 *
 * **It is a description, and it says so.** The figure below draws the popup's regions and its
 * controls and **renders no interactive element at all**: not a disabled button, not
 * `role="button"`. A preview containing a `Copy address` button that does nothing when pressed is
 * the same fake-UI defect `extension-client` removed from the popup itself, which is a control
 * reporting an action the product cannot take. `design.md` D2 records why a disabled control is
 * not a compromise here.
 *
 * **It names no provider.** The extension reaches Mail.tm first and Guerrilla Mail behind it, and
 * that is true; the page does not say so. `sections.spec.ts` asserts this page names no provider
 * but the one it can reach, and that guard is worth more than a sentence about which provider
 * answers first, which is a resilience detail rather than the capability a visitor is deciding
 * about. `design.md` D4 records the reasoning and the guard's own stated reason.
 *
 * **It states no cadence and no interval**, for the reason the website's own inbox does not:
 * `website-client` requires the page to state no cadence it cannot support, and the popup's
 * count comes from a check somebody asked for.
 *
 * ## Why the labels are declared as key/label pairs
 *
 * Because the figure may only show strings the popup actually renders. Every label below is one
 * `popup-copy.ts` entry, and a boundary assertion resolves each `key` and requires `label` to be
 * its value, which is also how a label that became a `{token}` template or a function of the
 * count is caught, from the extension's own data rather than from a filter written here.
 */
export const EXTENSION_PREVIEW: {
  readonly heading: string;
  readonly lede: string;
  readonly caption: string;
  readonly note: string;
  readonly regions: readonly PreviewRegion[];
} = {
  // Basis: `page-composition` requires a region's heading to name what that region is for.
  // Parallel with "What happens, in order" and "Why SpectreMail", and it names the subject
  // rather than the benefit, because the benefit is the lede's job.
  heading: "The extension, in this browser",
  // Basis: `extension-client` - the popup's first milestone actions, all performed through the
  // shared session. It names no provider; see the note above and `design.md` D4.
  lede: "The same SpectreMail, as a Chromium extension. It creates an address from a panel in the toolbar and keeps it in the extension's own storage, separately from this page.",
  // Basis: `extension-client` - the popup "SHALL report the provider's status" and "SHALL
  // render what the session reports". The count comes from a check the user asked for, because
  // "The background service worker carries no polling until its lifetime is measured" holds, so
  // the caption states what the popup shows rather than what it might do later.
  caption: "The popup, as it opens once it holds an address.",
  // **Present tense, and no milestone is named.** There is no release workflow, no store
  // listing, and no signed artifact in this repository, so there is nothing for a link to
  // resolve to. `design.md` D5 records why this sentence exists rather than the section saying
  // nothing: a region that previews an extension and never mentions obtaining it reads as an
  // oversight, and an absence left undescribed is what gets filled in by whatever change
  // touches the file next.
  note: "It is built in this repository and loaded unpacked, so there is no store listing and no download.",
  regions: [
    {
      // Basis: `extension-client` - the popup "SHALL offer to copy the address" and "SHALL show
      // the provider that mailbox belongs to". The provider is deliberately unnamed here;
      // `does` says the popup names it rather than printing a value this page would have to
      // invent.
      does: "It shows the address and the provider that answered, and copies the address when you ask.",
      labels: [{ key: "copy", label: "Copy address" }],
    },
    {
      // Basis: `extension-client` - the popup "SHALL render what the session reports" and
      // "SHALL NOT render a status it computed itself", plus the requirement that where a
      // fallback occurred the popup names the one it fell back from.
      does: "It reports what the provider says when you ask, and names which one answered if it had to fall back.",
      labels: [
        { key: "status", label: "Provider status" },
        { key: "unknown", label: "Not asked yet" },
        { key: "askStatus", label: "Check provider" },
      ],
    },
    {
      // Basis: `extension-client` - the popup "SHALL show a count of messages obtained from a
      // check the user asked for, because no background polling exists in this milestone". The
      // second sentence is that same fact in the visitor's terms, and states no interval.
      does: "It shows how many messages a check found. You ask for the check; nothing polls on its own.",
      labels: [
        { key: "inbox", label: "Inbox" },
        { key: "empty", label: "No mail has arrived." },
        { key: "check", label: "Check for mail" },
      ],
    },
  ],
};

/**
 * What the page can and cannot do.
 *
 * **These five sentences are not new copy.** They are the existing limits list, moved from
 * the middle of the page to the footer unchanged — `website-client`'s delta requires them to
 * travel with their content intact, because each is a measurement or a promoted requirement
 * rather than a summary:
 *
 * - the provider sentence is the measured CORS fact in `provider-config.ts`;
 * - the two message sentences are what the inbox and `MessageView` do;
 * - the code-and-link sentence names `website-client`'s *`A detection is acted on only when
 *   the user asks`*, which is what replaced *"This slice shows what it found and does not act
 *   on it"*;
 * - the no-server sentence is the architecture rule against proxying a provider.
 *
 * **The count in the paragraph above was four until this slice's verification pass read it
 * against the array**, which has five entries and has had since `website-sections`. A
 * comment that says four beside a list of five is a comment nobody reads, and it was here
 * because the list was last edited by a change that counted its own additions elsewhere and
 * not here. **It is corrected in place rather than deleted**, because the list is the thing
 * the requirement constrains and a reader comparing the two deserves them to agree.
 *
 * **The code-and-link sentence was reworded, and this is the recorded instance of a limit
 * changing rather than travelling.** `verification-actions` delivered the two actions that
 * sentence used to forbid, so the sentence became untrue; `website-client`'s amendment says
 * so in terms, and the requirement's own *"no limit SHALL be dropped to make room for a
 * section"* clause does not cover it - the bullet was not dropped for space, it was dropped
 * because it stopped being true. **The replacement still states a limit rather than a
 * capability**, which is the point: the page says what it will not do on its own, and a
 * visitor reading only the footer is told the boundary rather than the feature list.
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
  "It copies a code and follows a link only when you ask it to.",
  "No server is involved. SpectreMail operates no backend and never relays a provider request.",
];

/**
 * The page's regions, in the order it renders them.
 *
 * **The order is data so that it is a requirement that can be checked.** Two compositions with
 * the same five regions in a different order are different products, and the only way to assert
 * an order is to have it somewhere a reader, or a browser check, can see.
 *
 * **The product is first, and it is the product.** The roadmap's first section is *Live product
 * hero* and the roadmap then says *"The product itself should remain the main hero"*; both hold
 * here because the first entry **is** the working address rather than a description of one.
 * `design.md` D1 records the alternative that was rejected for this.
 *
 * **`extension` sits between the reasons and the footer**, which is the fourth position in the
 * roadmap's own five-section list. It is the last region before the limits, and that is where a
 * description of a second client belongs: after what the product does and why, before what it
 * cannot do.
 *
 * **This list has said four and now says five, and the requirement's title had been saying five
 * since `website-sections` was promoted.** A count that lives only in a heading is a count
 * nothing checks. It lives here now, next to `PageRegion` and the browser tier's DOM comparison,
 * so the three cannot disagree.
 */
export const PAGE_ORDER = ["product", "steps", "reasons", "extension", "footer"] as const;

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
  extension: "extension",
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
