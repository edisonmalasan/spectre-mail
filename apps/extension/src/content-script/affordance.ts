/**
 * The one control this product puts on someone else's page, and the shadow root it lives in.
 *
 * ## Why a shadow root, and why `mode: "open"`
 *
 * **A page's stylesheet must not reach the control.** Every site has a rule that would break this
 * button — `button { border-radius: 999px }`, `button { font-size: 22px }`, an `all: unset`
 * somewhere in a reset — and a control this product draws has to look like itself on all of them.
 * A shadow root is the only mechanism the platform offers for that, and `all: initial` on `:host` is
 * what makes it hold: it drops every inherited value the page could have set.
 *
 * **`open`, and that is a decision rather than a default.** `closed` would hide the control from the
 * page's own scripts too, and this product does not claim to be invisible — it claims to be
 * **unstyleable and unaddressable**. A `closed` root would additionally make its own button
 * unreachable for the browser tier, so the "the page cannot see it" assertions would be
 * unfalsifiable: nothing could reach in to check.
 *
 * ## Why these attribute names
 *
 * **They are the seam between this module and its two consumers.** `affordance.ts` owns the
 * spelling; the unit tier and the browser tier both read the constant rather than repeating the
 * string, so a rename breaks the build instead of quietly making every assertion match nothing. A
 * reader answering "no host" for a page that has one is the failure mode this avoids.
 *
 * ## The stylesheet, inlined, and why it is not a token reference
 *
 * **A shadow root cannot read the page's custom properties unless they are inherited, and
 * `--spectre-*` lives in a stylesheet this content script deliberately does not load.** The change
 * that added this file committed to adding no design token: the page's tokens belong to the page,
 * and a control drawn inside someone else's page is not a surface `visual-system` describes. **The
 * creation states below added no token and no motion either**, which is why there is still exactly
 * one rule set here and no `@keyframes` — a second one would be visual surface no capability
 * describes.
 *
 * ## Why the label carries the state, and why that is not a compromise
 *
 * **This button's label is its accessible name, and it is the only surface this product has inside
 * somebody else's page.** There is no error region, no toast, and no banner to draw here, and a
 * control that reports "creating" while its name still says "insert" is a control lying about its
 * own state. So the name changes with the state, and every state a person can reach is a named
 * constant in this file rather than a sentence written at a call site.
 *
 * **A provider's own words become the name when it refuses**, for the reason
 * `provider-abstraction` requires a refusal to be surfaced rather than summarised — and this is the
 * only place inside a stranger's page where a provider's words can reach a person at all. The
 * tradeoff is stated rather than hidden: the label is then a sentence rather than an action, and
 * the person who needs to try again presses a button whose name does not say what it does. That is
 * the cost of having no other surface, and the alternative — swallowing the provider's words and
 * showing this product's summary — is a second thing that can disagree with the provider.
 *
 * ## Why the button is `disabled` while waiting rather than merely guarded
 *
 * **`disabled` is what makes "one request per activation" a property of the platform instead of a
 * promise this code keeps.** A guard in the handler would satisfy every test that presses the
 * button through the DOM and would fail for a person who triggered it some other way. The cost is
 * that a disabled button leaves the tab order, so focus returns to the document while the request
 * is outstanding — which is why `focusout` treats a disabled control as *not* focus leaving
 * (`controller.ts`).
 *
 * @module
 */

/** The attribute marking the element the affordance is attached to the page through. */
export const AFFORDANCE_HOST_ATTRIBUTE = "data-spectre-affordance";

/** The attribute marking the control itself, inside the shadow root. */
export const AFFORDANCE_BUTTON_ATTRIBUTE = "data-spectre-affordance-button";

/**
 * The label the control carries when this device already holds an address.
 *
 * **Unchanged by the creation states, and the requirement that reads it is still enforced.** One
 * control that inserts and one that creates must be distinguishable by their names, so
 * `in-page-integration`'s "it SHALL NOT describe that affordance as creating anything" is a claim
 * about this constant's wording.
 */
export const AFFORDANCE_LABEL = "Use SpectreMail";

/**
 * The label this control carries, naming the address it will insert.
 *
 * **The address is in the name because the control now chooses it.** Before `site-associations` a
 * device held one address, so "Use SpectreMail" was as specific as the offer could be. A device
 * holding several resolves a host to one of them, and a control whose name says only "Use" would be
 * asking somebody to press a button whose effect they cannot see — on a page that is not ours, where
 * an unexpected address is the difference between a form that fills in and one that fills in wrongly.
 *
 * **A colon, so a screen reader pauses.** The separator is the one character here that reaches a
 * person who cannot see the button; an em dash is frequently read as nothing at all, which would
 * leave "Use SpectreMailuser@example.com" read aloud as one word.
 *
 * @param address - The address this press would insert, verbatim as the provider wrote it. It is not
 *   shortened: a name that truncated the domain would stop being the thing the person is checking.
 */
export function affordanceInsertLabel(address: string): string {
  return `${AFFORDANCE_LABEL}: ${address}`;
}

/**
 * The label when this device holds no address, and the word that distinguishes the two offers.
 *
 * **"Create", not "Use".** {@link AFFORDANCE_LABEL} begins with "Use", and a label of
 * "Use SpectreMail" for both cases would be true of neither — inserting something already held and
 * asking a provider for something that does not exist are different acts with different
 * consequences at the provider, and the person pressing the button is the only one who can tell them
 * apart. **The insert control's name also carries the address it will insert** (see
 * {@link affordanceInsertLabel}), so "which address" is answerable from the control alone.
 */
export const AFFORDANCE_CREATE_LABEL = "Create a SpectreMail address";

/**
 * The label while a request this extension made is still outstanding.
 *
 * **A state, not a duration.** Nothing in this product has measured how long a provider takes to
 * create a mailbox, so this word claims only that a request was made and no answer has arrived.
 */
export const AFFORDANCE_WAITING_LABEL = "Creating an address…";

/**
 * The label when the wait passed and no mailbox could be found.
 *
 * **It says "could not confirm", and never "failed" and never "no mailbox was created".** Neither of
 * those was observed: this device has no note of an address, which is a different fact from a
 * provider having refused, and a page that told somebody "nothing was created" could be wrong in the
 * direction that loses them an address that does exist. The same restraint `apps/web`'s `restoreFailed`
 * state applies, where a failure is a condition of the mailbox rather than a verdict on it.
 */
export const AFFORDANCE_UNCONFIRMED_LABEL = "Could not confirm an address";

/**
 * The control's own styling.
 *
 * **`all: initial` on `:host` first**, because everything below assumes the page's inherited font,
 * colour and box-sizing are not in play. It is load-bearing rather than tidying: a `display: block`
 * inherited from the page's `div` rule would put the host on its own line and push the form apart.
 *
 * **The focus ring is `#7c6cf0`, the same violet the token layer declares for the accent in both
 * schemes**, chosen so the control on a stranger's page is recognisably this product's and
 * recognisably keyboard-reachable. It is asserted to be *different from the same control unfocused*,
 * because a permanent outline would pass a presence check and fail the requirement.
 *
 * **`button[disabled]` is styled and not left to the platform's default**, because the platform's
 * default for a disabled button in a shadow root is derived from the *user agent* sheet and says
 * nothing about whether this control looks like itself on a stranger's page — which is the property
 * the whole shadow root exists to provide.
 */
const SHADOW_STYLES = `
  :host { all: initial; }
  button {
    font: 500 13px/1.4 ui-sans-serif, system-ui, sans-serif;
    color: #ffffff;
    background: #2f2f33;
    border: 1px solid #55555c;
    border-radius: 4px;
    padding: 6px 10px;
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover { background: #3b3b41; }
  button:focus-visible { outline: 2px solid #7c6cf0; outline-offset: 2px; }
  button[disabled] { background: #2f2f33; border-color: #55555c; cursor: progress; }
`;

/** What the affordance hands back so a caller can look at it and take it away again. */
export interface Affordance {
  /** The element inserted into the page. Removing it removes the control. */
  readonly host: HTMLElement;
  /** The control itself, inside the host's shadow root. */
  readonly button: HTMLButtonElement;
  /**
   * Replace the control's name, which is also the text it shows.
   *
   * **`textContent`, not a child node, so there is nothing for the page to walk.** A button
   * holding a `<span>` the controller can retitle is a button whose label is two elements deep,
   * and every reader in this repository — `shadowRoot.textContent`, an accessible name, a
   * Playwright locator — would then have to know which of them is the name.
   */
  readonly setLabel: (label: string) => void;
  /**
   * Mark a request outstanding, or no longer.
   *
   * **`disabled` plus `aria-busy`, and the two are not redundant.** `disabled` is what stops a
   * second activation reaching the extension at all; `aria-busy` is what tells a screen reader the
   * control is working rather than merely unavailable, and it is the half that would be missing if
   * this were only a guard in the click handler.
   */
  readonly setPending: (pending: boolean) => void;
  /** Detach the click handler and remove the host. Idempotent. */
  readonly remove: () => void;
}

/** How the control is drawn. */
export interface AffordanceOptions {
  /** The name it starts with. One of the constants above, or a provider's own words. */
  readonly label: string;
  /** What pressing it does. Called at most once per outstanding request — see `setPending`. */
  readonly onPress: () => void;
}

/**
 * Draw the control, without inserting it.
 *
 * **Built here and placed by the caller**, because placement depends on the field it belongs to and
 * on decisions the controller makes: this function knows how to draw a button, and it deliberately
 * knows nothing about focus, fields, documents or what an address is.
 *
 * **`remove()` removes the listener as well as the node**, so a removed affordance that a page kept a
 * reference to cannot be pressed into a controller that has already moved on.
 *
 * **`type = "button"`, so pressing it never submits the form.** The field belongs to a form whose
 * author wrote their own submit handler, and a control this product inserted has no business
 * triggering it.
 *
 * @param options - The name to start with, and what pressing it does.
 */
export function createAffordance({ label, onPress }: AffordanceOptions): Affordance {
  const host = document.createElement("div");
  host.setAttribute(AFFORDANCE_HOST_ATTRIBUTE, "");

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = SHADOW_STYLES;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute(AFFORDANCE_BUTTON_ATTRIBUTE, "");
  button.addEventListener("click", onPress);

  shadow.append(style, button);

  return {
    host,
    button,
    setLabel: (next: string) => {
      button.textContent = next;
    },
    setPending: (pending: boolean) => {
      button.disabled = pending;
      if (pending) {
        button.setAttribute("aria-busy", "true");
      } else {
        button.removeAttribute("aria-busy");
      }
    },
    remove: () => {
      button.removeEventListener("click", onPress);
      host.remove();
    },
  };
}
