/**
 * The one control this product puts on someone else's page, and the shadow root it lives in.
 *
 * ## Why a shadow root, and why `mode: "open"`
 *
 * **A page's stylesheet must not reach the control.** Every site has a rule that would break
 * this button — `button { border-radius: 999px }`, `button { font-size: 22px }`, an `all: unset`
 * somewhere in a reset — and a control this product draws has to look like itself on all of
 * them. A shadow root is the only mechanism the platform offers for that, and `all: initial` on
 * `:host` is what makes it hold: it drops every inherited value the page could have set.
 *
 * **`open`, and that is a decision rather than a default.** `closed` would hide the control from
 * the page's own scripts too, and this product does not claim to be invisible — it claims to be
 * **unstyleable and unaddressable**. A `closed` root would additionally make its own button
 * unreachable for the browser tier, so the "the page cannot see it" assertions would be
 * unfalsifiable: nothing could reach in to check.
 *
 * ## Why these attribute names
 *
 * **They are the seam between this module and its two consumers.** `affordance.ts` owns the
 * spelling; the unit tier and the browser tier both read the constant rather than repeating the
 * string, so a rename breaks the build instead of quietly making every assertion match nothing.
 * A reader answering "no host" for a page that has one is the failure mode this avoids.
 *
 * ## The stylesheet, inlined, and why it is not a token reference
 *
 * **A shadow root cannot read the page's custom properties unless they are inherited, and
 * `--spectre-*` lives in a stylesheet this content script deliberately does not load.**
 * `design.md` D7 records that this change adds no design token: the page's tokens belong to the
 * page, and a control drawn inside someone else's page is not a surface `visual-system`
 * describes. So the values here are literals, and the only requirement placed on them is the
 * one every control in this product has — a **visible focus ring**, asserted in a real browser
 * by the tier that reads a computed style.
 *
 * @module
 */

/** The attribute marking the element the affordance is attached to the page through. */
export const AFFORDANCE_HOST_ATTRIBUTE = "data-spectre-affordance";

/** The attribute marking the control itself, inside the shadow root. */
export const AFFORDANCE_BUTTON_ATTRIBUTE = "data-spectre-affordance-button";

/** The label the control carries. */
export const AFFORDANCE_LABEL = "Use SpectreMail";

/**
 * The control's own styling.
 *
 * **`all: initial` on `:host` first**, because everything below assumes the page's inherited
 * font, colour and box-sizing are not in play. It is load-bearing rather than tidying: a
 * `display: block` inherited from the page's `div` rule would put the host on its own line and
 * push the form apart.
 *
 * **The focus ring is `#7c6cf0`, the same violet the token layer declares for the accent in
 * both schemes**, chosen so the control on a stranger's page is recognisably this product's and
 * recognisably keyboard-reachable. It is asserted to be *different from the same control
 * unfocused*, because a permanent outline would pass a presence check and fail the requirement.
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
`;

/** What the affordance hands back so a caller can look at it and take it away again. */
export interface Affordance {
  /** The element inserted into the page. Removing it removes the control. */
  readonly host: HTMLElement;
  /** The control itself, inside the host's shadow root. */
  readonly button: HTMLButtonElement;
  /** Detach the click handler and remove the host. Idempotent. */
  readonly remove: () => void;
}

/**
 * Draw the control, without inserting it.
 *
 * **Built here and placed by the caller**, because placement depends on the field it belongs
 * to and on decisions the controller makes: this function knows how to draw a button, and it
 * deliberately knows nothing about focus, fields or documents.
 *
 * **`remove()` removes the listener as well as the node**, so a removed affordance that a page
 * kept a reference to cannot be pressed into a controller that has already moved on.
 *
 * **`type = "button"`, so pressing it never submits the form.** The field belongs to a form
 * whose author wrote their own submit handler, and a control this product inserted has no
 * business triggering it.
 */
export function createAffordance(onPress: () => void): Affordance {
  const host = document.createElement("div");
  host.setAttribute(AFFORDANCE_HOST_ATTRIBUTE, "");

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = SHADOW_STYLES;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = AFFORDANCE_LABEL;
  button.setAttribute(AFFORDANCE_BUTTON_ATTRIBUTE, "");
  button.addEventListener("click", onPress);

  shadow.append(style, button);

  return {
    host,
    button,
    remove: () => {
      button.removeEventListener("click", onPress);
      host.remove();
    },
  };
}
