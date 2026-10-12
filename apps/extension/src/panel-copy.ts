/**
 * Every sentence the side panel can say, as data.
 *
 * ## Why this is its own module and not an extension of `popup-copy.ts`
 *
 * **`design.md` D9 gives the reason, and it is the reason `popup-copy.ts` gives for itself minus
 * the one that does not apply here.** `popup-copy.ts` exists because the **website depicts the
 * popup**, and a depiction cannot be kept honest by review. **The website does not depict this
 * panel** - D9 commits `apps/web` to 125 tests and no change at all, and what a visitor is shown
 * about a second surface is a composition decision this milestone deliberately does not make.
 *
 * **So this module is exported for the reason the other one names second: a claim is reviewable
 * beside the requirement it satisfies, and a test can read what the product says without scraping
 * rendered text for it.** Four sets of words kept inline in a component are four claims a reviewer
 * reads in their markup context rather than beside their requirement.
 *
 * ## The four claims D9 names, and each one is in this delta
 *
 * 1. {@link PANEL_COPY.host} - it names the host. *Requirement: the side panel names the page it is
 *    beside.*
 * 2. {@link PANEL_COPY.cannotNameHost} and {@link PANEL_COPY.noScriptHere} - it says when it
 *    cannot. *Requirement: ... and reports when it cannot.* **Two sentences rather than one,
 *    because D4's union has two refusals** - an answer with nothing usable, and a page with no
 *    script of this extension's - and `docs/PROVIDERS.md` §4.6 measured that a content script
 *    answering nothing **resolves**, so the two are genuinely different faults.
 * 3. {@link PANEL_COPY.providerFailed} - it reports a failed provider. *Requirement: the side panel
 *    renders the mailbox ... SHALL report a provider failure ... rather than showing an empty inbox.*
 * 4. {@link PANEL_COPY.mailboxGone} - it says when the mailbox is gone. *Requirement: ... SHALL say
 *    so and SHALL not offer to read it.*
 *
 * ## What is deliberately NOT here
 *
 * **The message surface's words.** The listing, the codes, the delivery reports and the link labels
 * are `POPUP_COPY`'s, in `MessageSurface.tsx`, because both surfaces render the same facts about
 * the same mailbox - see that module's own note. **A panel that spelled them out again would be the
 * second copy of a decision table `design.md` D2 forbids**, and a website depiction resolving
 * labels against `POPUP_COPY` must keep finding them there.
 *
 * @module
 */

/** Every sentence the panel can say that is its own rather than the message surface's. */
export const PANEL_COPY = {
  /** The panel's own title, which is its surface and not the popup's. */
  title: "SpectreMail",

  /** While the boot read is outstanding. */
  booting: "Reading what this device saved",
  /**
   * **Shown instead of anything else when the boot read failed.**
   *
   * **The refusal to collapse `null` and a rejection is the whole reason this sentence exists**,
   * and it is `Popup.tsx`'s rule stated again for a second surface: a read reported as absent makes
   * a person who came back for their address believe they have none - and then offers to make a
   * new one, overwriting the one they came back for.
   */
  bootFailed: "SpectreMail could not read its own storage, so it will not create an address.",

  /**
   * **The heading above the host line, and it names no host itself.**
   *
   * The requirement is that the panel *names* the page's host; a heading that asserted one would
   * be a claim the union below it cannot always support.
   */
  hostHeading: "Page beside this panel",

  /**
   * **Claim two, first refusal: an answer arrived carrying nothing usable.**
   *
   * **It says it cannot name the page rather than showing a blank line**, and it offers no mailbox
   * as being this page's - both of which are the requirement's second and third clauses.
   */
  cannotNameHost: "That page did not say which host it is on, so no address is offered as its own.",

  /**
   * **Claim two, second refusal: the page carries no script of this extension's.**
   *
   * **Named separately from {@link PANEL_COPY.cannotNameHost} because they are different faults.**
   * A script that answers nothing and a script that is not there produce the same resolution on
   * this channel - `docs/PROVIDERS.md` §4.6 measured that - so the panel cannot tell them apart
   * from the answer alone, and it says the one thing both support: it cannot name the page. The
   * rest of the panel continues to work either way, which the requirement's last clause requires.
   */
  noScriptHere: "This page is not one SpectreMail runs on, so it cannot say which host it is.",

  /** While the host has not been asked yet - the fourth of D4's four observations. */
  hostNotAsked: "Asking that page which host it is on…",

  /**
   * **The host is named and this device used an address on it.**
   *
   * **The association is reported rather than assumed**, because the requirement is that the panel
   * SHALL name *which* mailbox this device last used on that host - and a host named with no
   * account of the association would be a panel that got half of it right.
   */
  hostHasMailbox: (hostname: string, address: string): string =>
    `${hostname} — last used with ${address}`,

  /**
   * **The host is named and this device has used no address on it.**
   *
   * **The alternative mailbox is offered here rather than silently**, and the requirement's second
   * clause is exactly this: the panel SHALL name the mailbox this device last used on that host,
   * **or say it holds none**. Saying it holds none is not the same as showing an empty inbox, and
   * a panel that showed the newest address as though the page had used it would be the one wrong
   * answer D4 names.
   */
  hostHasNoMailbox: (hostname: string): string =>
    `${hostname} — no address has been used here yet.`,

  /**
   * **The host is named and it *was* used with an address this device no longer holds.**
   *
   * **A fourth sentence because this host's state has three named outcomes, not two, and the third
   * one is the one a pair of sentences cannot express.** `hostHasNoMailbox` would be a lie here —
   * an address *was* used here — and {@link PANEL_COPY.hostHasMailbox} would be a worse one, because
   * `resolveForHost` falls back to the newest for a stale association and naming that newest as
   * *this host's* address is the false association D4 exists to prevent.
   *
   * **So this says the host and refuses the association, and the newest address is still shown
   * below it as this device's own.** That is the requirement's third clause exactly: no mailbox is
   * offered as being that page's, and the rest of the panel keeps working.
   */
  hostAssociationGone: (hostname: string): string =>
    `${hostname} — the address used here is no longer on this device.`,

  /**
   * The heading above the address this page resolves to.
   *
   * **It names the provider rather than this surface's own name**, for the popup's reason: the
   * provider is the fact a person checks before typing an address into somebody else's form, and a
   * heading reading "Address" would be a label about layout where a claim is wanted.
   */
  addressHeading: (provider: string): string => provider,

  /**
   * **Claim three: a provider failed.**
   *
   * **The provider's own words are interpolated, never a summary written here** - the same rule
   * `Popup.tsx`'s `health` line follows and the same reason: a paraphrase of a refusal is a
   * sentence this product invented while describing somebody else's failure.
   *
   * **And it is a report rather than an empty listing**, which is the requirement's operative
   * clause: showing nothing at all would be indistinguishable from a mailbox with no mail in it.
   */
  providerFailed: (provider: string, description: string): string =>
    `${provider} could not be reached. It said: ${description}`,

  /** This device holds no mailbox at all, so the panel offers to create one. */
  noMailboxHeld: "This device has no address yet.",

  /**
   * **Claim four: the mailbox is gone.**
   *
   * **"No longer exists" and not "no mail has arrived"**, and the difference is measured rather
   * than stylistic: `docs/PROVIDERS.md` §3 records a dead Guerrilla Mail session answering `HTTP
   * 200` with an empty inbox, so "nothing has arrived" and "this address is gone" are the same
   * response. A panel that rendered the empty-inbox sentence here would be reporting a mailbox
   * that no longer exists as though it were merely quiet.
   */
  mailboxGone: "That address no longer exists.",

  /** The heading above the mailboxes this device holds. */
  heldHeading: "Addresses on this device",

  /**
   * **The chooser's own name, and it is a second string rather than {@link PANEL_COPY.heldHeading}
   * reused.**
   *
   * *Requirement: `extension-client` — ... offers the mailboxes this device holds most recently,
   * each as a control that makes that mailbox the mailbox this panel view is about.*
   *
   * **The heading says what the list *is*; this says what the list *is for*,** and a `radiogroup`
   * carrying no name is an unnamed set of choices on a surface whose requirement names them as
   * choices. **It names no host and no provider**, because what it names is a fact about this panel
   * and not about the page beside it — and the host sentence three sections up already carries the
   * host, so a name repeating it here would be the list claiming a second fact about the page.
   */
  heldGroup: "Choose which address this panel shows",

  /**
   * **The control for one mailbox, and a function of the address.**
   *
   * *Requirement: ... **each as a control that can act, rather than text** — Several mailboxes are
   * held.*
   *
   * **It names the press as well as the value, because a list of addresses where every entry reads
   * as a bare address gives a person nothing to decide between.** It is not a `<select>` and not a
   * row of toggles — `design.md` D6 gives the reason, and it is the reason the control says what
   * pressing it does.
   *
   * **It names no host, and that is a rule rather than an omission:** `resolve-for-host.ts` decides
   * which mailbox a host means, and an entry that said *"the address for this site"* would restate
   * that rule's answer in a place the rule does not live — which is the second spelling D3 exists to
   * prevent. **It also names no provider**, for the same reason `addressHeading` above is allowed
   * one: the provider is a fact a person checks before typing an address in, and this entry is a
   * choice, not a reading.
   */
  chooseMailbox: (address: string): string => `Show ${address} in this panel`,

  /**
   * **Which mailbox this panel view is about, said in words rather than marked with a tick.**
   *
   * *Requirement: WHEN a person chooses one of the offered mailboxes THEN the panel SHALL show that
   * mailbox's messages **AND the panel SHALL say which mailbox it is showing**.*
   *
   * **`aria-checked` alone does not discharge that clause**, and `design.md` D6 names why: a
   * radiogroup whose checked state is only in the accessibility tree reads as correct to assistive
   * technology and as *which one?* to a person. So both carry it — the attribute and this sentence —
   * and a case reads each.
   *
   * **It sits inside the chooser rather than beside the address section, and the reason is that the
   * address section is not always on screen.** `Panel.tsx` withholds `panel-address` beside a page
   * the panel cannot name, and `design.md` D4 keeps that guard — so beside such a page **this is the
   * only sentence that says what the view is about.** It says it beside the chooser that changed it,
   * which is where a person who pressed one of them is looking.
   */
  showingMailbox: (address: string): string => `This panel is showing ${address}.`,

  /**
   * Offering a new address, when a host beside the panel **was named** and this device holds none
   * for it.
   *
   * **The address is implicitly for that host**, and that is what the sentence may leave unsaid here
   * because the host is on screen three lines above in the same section.
   */
  createForHost: "Create an address",

  /**
   * Offering a new address beside a page this panel **cannot name**.
   *
   * **A separate string rather than a parameter, and the reason is that the two are different
   * claims.** {@link PANEL_COPY.createForHost} may leave the host unsaid because the host is named
   * beside it; here there is **no host to leave unsaid**, and a sentence that reads as though
   * there were would be the same defect in the other direction — a panel inventing a host for a
   * page it just said it could not identify.
   *
   * **So this says what the address is instead of what it is for**: it is tied to nothing, because
   * a mailbox created while the page is unnamed is recorded against no host at all — and the panel
   * is not going to guess one later. **That is also the reason the control is offered here rather
   * than withheld, and it is the orchestrator's decision** — see `design.md` A17.
   */
  createForUnnamedPage: "Create an address, not tied to that page",

  /** While an address is being asked for. */
  creating: "Asking for an address",

  /**
   * **A creation that was made at the provider and not kept here.**
   *
   * **`create-mailbox.ts` answers `notStored` without the address**, deliberately, so that a caller
   * cannot insert a mailbox whose write failed — and this is the sentence the panel says about it.
   * **It names no address**, because there is none this device can produce again.
   */
  addressNotKept: "An address was made, but this device could not keep it, so it is not offered.",

  /**
   * **A background context that answered nothing this panel recognised.**
   *
   * **The same shape as `fillUnconfirmed`, and the same reason:** an answer nobody recognised is not
   * a worse outcome, it is no outcome — and a panel that reported "the provider refused" about an
   * answer it did not recognise would be describing somebody else's failure from imagination.
   */
  couldNotConfirmCreation: "Could not confirm that an address was made.",

  /** The heading above the verification links found in an opened message. */
  linksHeading: "Verification links in this message",
  /** A message the parser read whole and found no verification link in. */
  noLinks: "No verification link was found in this message.",
  /** The control that opens a link, in a new tab. */
  openLink: "Open this link",
  /**
   * The control that puts a link on the clipboard.
   *
   * **A plain string and not a template**, because the value it names is the destination's *host* —
   * which `Links` renders as its own node beside this control. **Putting the host inside this
   * control's accessible name would make the name change with every link**, and the requirement is
   * that the host is legible *beside* the thing that opens it.
   */
  copyLink: "Copy this link",

  /**
   * The control that puts one code on the clipboard, above the code it acts on.
   *
   * **A function of the code, and it has to be one for the same reason {@link POPUP_COPY.fillCode}
   * is a template.** The person pressing it is looking at the code on the line above and is *not*
   * sure which field on somebody else's page it belongs to, so the name says what pressing it does.
   */
  copyCode: (code: string): string => `Copy code ${code}`,

  /** Every clipboard control's own confirmation, and one string for all of them. */
  copiedValue: "Copied.",
  /**
   * Every clipboard control's own refusal.
   *
   * **`POPUP_COPY.copyFailed` and not this, deliberately duplicated.** The popup's sentence names
   * *the address*, and a panel refused on a code has a value it cannot select by hand — so the
   * panel says what to do instead of repeating advice that does not apply to what it copied.
   */
  copyFailedValue: "The clipboard refused. The value is still on screen to copy by hand.",
} as const;

/** Every entry name, for a caller that resolves names rather than holding them. */
export const PANEL_COPY_KEYS = Object.keys(PANEL_COPY);

/**
 * **The entries the chooser reads, declared rather than derived, for
 * {@link POPUP_COPY_TEMPLATES}'s reason.**
 *
 * *Requirement: `extension-client` — ... **offers the mailboxes this device holds most recently, each
 * as a control that makes that mailbox the mailbox this panel view is about**, AND ... the panel SHALL
 * say which mailbox it is showing.*
 *
 * **A chooser entry renamed would leave the chooser's sweep reading nothing**, and a sweep reading
 * nothing satisfies every assertion above it for ever — so the list is a declaration a test checks in
 * both directions, not a predicate the test derives from the object it is checking.
 *
 * **It is a list and not a flag on the entries**, because a flag travels with a rename: a key
 * `heldGroup: CHOOSER` becomes `heldName: CHOOSER` and every sweep still passes while the entry a
 * reviewer reads by name is not the entry any rule looks at. **And it is not derived from "every
 * function-valued entry"** — eight entries here are functions, four of them about a *host*, and a
 * chooser defined as "the function-valued ones" would sweep `hostHasMailbox` into a rule about the
 * chooser and then fail on the very host it is supposed to leave alone.
 */
export const PANEL_CHOOSER_KEYS = ["heldGroup", "chooseMailbox", "showingMailbox"] as const;
