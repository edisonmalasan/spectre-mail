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

/** The attribute marking the element the asking control is attached to the page through. */
export const FIELD_CHOICE_HOST_ATTRIBUTE = "data-spectre-field-choice";

/** The attribute marking one of the asking control's choices, inside its shadow root. */
export const FIELD_CHOICE_OPTION_ATTRIBUTE = "data-spectre-field-choice-option";

/** The attribute marking the asking control's way out, which fills nothing. */
export const FIELD_CHOICE_DISMISS_ATTRIBUTE = "data-spectre-field-choice-dismiss";

/**
 * The asking control's heading, with the code appended.
 *
 * **The code is in the heading and the field is on the button, because those are two different
 * questions.** "Which field?" is the decision this control exists for, and it belongs on the
 * control being pressed; "with what?" is not in doubt and belongs once, above them. A heading that
 * omitted the code would leave a person confirming that a field is right without knowing which
 * value would go into it, on a page that has just navigated.
 */
export const FIELD_CHOICE_HEADING_PREFIX = "Put the code";

/** The start of every choice's name. */
export const FIELD_CHOICE_OPTION_PREFIX = "Fill in";

/**
 * What a choice whose field **declares** its own purpose says that the others do not.
 *
 * **The requirement's preference, stated to the person rather than applied silently.** The page
 * wrote `autocomplete="one-time-code"`, which is the one signal a machine can read and a person
 * cannot see, so the choice that carries the page's own claim is marked — and the marking is a
 * sentence rather than an asterisk, because this control is read aloud by the same people who are
 * asked to identify a field by looking at one.
 */
export const FIELD_CHOICE_PREFERRED_SUFFIX = "(this page declares this is a code field)";

/**
 * The asking control's way out.
 *
 * **It exists because a control with no way to refuse is a control a person has to leave the page
 * to escape.** `in-page-integration` requires the control to be removable once the person has
 * chosen *or dismissed*, and a dismiss that is only "choose something else" is not a refusal.
 */
export const FIELD_CHOICE_DISMISS_LABEL = "Leave the field alone";

/** How the asking control is arranged, which `SHADOW_STYLES` alone does not describe. */
const FIELD_CHOICE_STYLES = `
  .heading {
    font: 600 13px/1.4 ui-sans-serif, system-ui, sans-serif;
    color: #ffffff;
    margin: 0 0 6px;
  }
  .options { display: flex; flex-wrap: wrap; gap: 6px; }
  .preferred { border-color: #7c6cf0; }
  .dismiss {
    font: 400 12px/1.4 ui-sans-serif, system-ui, sans-serif;
    color: #c8c8ce;
    background: transparent;
    border: 1px solid #55555c;
    border-radius: 4px;
    padding: 5px 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  .dismiss:hover { background: #3b3b41; }
  .dismiss:focus-visible { outline: 2px solid #7c6cf0; outline-offset: 2px; }
`;

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

/** One field the person can choose, and what choosing it does. */
export interface FieldChoiceOption {
  /**
   * What this field is called to a person.
   *
   * **The page's own word for it**, produced by `code-field.ts`, and this module never composes it
   * into a sentence. The composition happens once, below, where the prefix is joined — so there is
   * one sentence in this file rather than one per caller.
   */
  readonly label: string;
  /** Whether this field **declares** its own purpose, which the requirement makes the preference. */
  readonly preferred: boolean;
  /** What this person chose by pressing this one. Called at most once — `remove` runs first. */
  readonly choose: () => void;
}

/** What the asking control hands back. */
export interface FieldChoice {
  /** The element inserted into the page. Removing it removes every control. */
  readonly host: HTMLElement;
  /** The choices, in the order the page lays the fields out. */
  readonly options: readonly HTMLButtonElement[];
  /** The control that fills nothing. */
  readonly dismiss: HTMLButtonElement;
  /**
   * Detach every listener and remove the host.
   *
   * **Idempotent, and it removes the listeners as well as the node**, for the reason
   * {@link Affordance.remove} records: a control a page kept a reference to must not be able to
   * press into a handler whose code has moved on.
   */
  readonly remove: () => void;
}

/**
 * Draw the asking control, without inserting it.
 *
 * ## Why a second drawer rather than {@link createAffordance} with two buttons
 *
 * **`createAffordance` is one button with one name and one pending state, and asking is N buttons
 * with a heading above them and a way out beside them.** Composing N affordances would give N
 * shadow roots, N hosts to place in the page, and N click handlers to tear down — and it would put
 * this product's heading, its dismissal and its option list into a shape where none of them
 * existed. **The shadow root, the attribute seam and the stylesheet are shared; the composition is
 * not.**
 *
 * ## Why the same `SHADOW_STYLES` and not a second one
 *
 * **A control drawn on somebody else's page must look like the same product, and two stylesheets
 * are two things that can drift.** The shared block styles every `button` in this root, so the
 * choices inherit the focus ring, the border and the hover without a second declaration of any of
 * them; only the arrangement is added, and only the arrangement is a fact about asking rather than
 * about this product's voice.
 *
 * **No design token is added here, for the reason the whole file was written.** The page's tokens
 * belong to the page, and a control drawn inside somebody else's page is not a surface
 * `visual-system` describes.
 */
export interface FieldChoiceOptions {
  /** The code this person has chosen to fill. Shown in the heading, verbatim. */
  readonly code: string;
  /** The fields, in page order, each already named by `code-field.ts`. */
  readonly options: readonly FieldChoiceOption[];
  /**
   * Called when the person takes the way out, after the control has removed itself.
   *
   * ## Why a refusal is reported and a choice is not
   *
   * **A choice calls the option's own `choose`, which the caller already owns; a refusal has no
   * option and so has no callback for the caller to have written.** Without this, a caller that
   * remembered the control it drew kept a reference to a control that was no longer on the page,
   * and the first version of this module's own case caught exactly that: the node was gone and
   * `pending()` still answered with it.
   *
   * **It is optional because a caller with nothing to remember needs nothing said to it,** and it
   * is called after `remove` rather than before so a caller reading the page sees the same state
   * in both paths.
   */
  readonly onDismissed?: () => void;
}

/** Draw the asking control, without inserting it. */
export function createFieldChoice({ code, options, onDismissed }: FieldChoiceOptions): FieldChoice {
  const host = document.createElement("div");
  host.setAttribute(FIELD_CHOICE_HOST_ATTRIBUTE, "");

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = SHADOW_STYLES + FIELD_CHOICE_STYLES;

  const heading = document.createElement("p");
  heading.className = "heading";
  heading.textContent = `${FIELD_CHOICE_HEADING_PREFIX} ${code}`;

  const list = document.createElement("div");
  list.className = "options";

  const buttons: HTMLButtonElement[] = [];
  const handlers: Array<() => void> = [];

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = option.preferred ? "preferred" : "";
    button.textContent = `${FIELD_CHOICE_OPTION_PREFIX} ${option.label}${
      option.preferred ? ` ${FIELD_CHOICE_PREFERRED_SUFFIX}` : ""
    }`;
    button.setAttribute(FIELD_CHOICE_OPTION_ATTRIBUTE, "");
    const onPress = option.choose;
    button.addEventListener("click", onPress);
    handlers.push(() => {
      button.removeEventListener("click", onPress);
    });
    buttons.push(button);
    list.append(button);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "dismiss";
  dismiss.textContent = FIELD_CHOICE_DISMISS_LABEL;
  dismiss.setAttribute(FIELD_CHOICE_DISMISS_ATTRIBUTE, "");
  const onDismiss = (): void => {
    control.remove();
    // **After `remove`, so a caller that reads the page in `onDismissed` sees the same state it
    // would have seen in the path where it removed the control itself.**
    onDismissed?.();
  };
  dismiss.addEventListener("click", onDismiss);

  shadow.append(style, heading, list, dismiss);

  const control: FieldChoice = {
    host,
    options: buttons,
    dismiss,
    remove: () => {
      for (const detach of handlers) {
        detach();
      }
      dismiss.removeEventListener("click", onDismiss);
      host.remove();
    },
  };

  return control;
}
