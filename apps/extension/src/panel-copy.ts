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
 * ## What IS here that is not a `POPUP_COPY` string, and why
 *
 * **§The one claim this panel has and the popup is forbidden from.** {@link PANEL_VERDICT_WORDING}
 * states a verdict per row, and `extension-client` says in two clauses - both naming **the popup** -
 * that the popup SHALL NOT indicate a message carries a verification until it has opened it. **So
 * these are the panel's sentences for the same reason `CodeClipboardActions` is caller-supplied
 * rather than a string in `POPUP_COPY`: a panel-only word placed in the shared object would let the
 * website's depiction claim the popup renders a thing it does not.** The popup passes nothing and
 * the shared component has no channel to render one through.
 *
 * @module
 */

import type { MessageVerdict } from "@spectre-mail/mailbox";
import { PRODUCT_NAME } from "@spectre-mail/ui/name";

/** Every sentence the panel can say that is its own rather than the message surface's. */
export const PANEL_COPY = {
  /**
   * The panel's own title, which is its surface and not the popup's.
   *
   * **Already the pattern the other seven surfaces were asked to adopt**: one copy constant, three
   * renderings, and a test reading the constant rather than scraping rendered text. `docs/BRANDING.md`
   * records this entry as the one surface already correct before this change, and what changed here
   * is what it reads and not how it is written - it held a bare literal of the same word, so making
   * it the reference cost nothing and left the three renderings exactly as they were.
   */
  title: PRODUCT_NAME,

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

  /**
   * ## The removal region - ten entries, and every sentence it shows
   *
   * *Requirement: `extension-client` - **Every sentence the region shows SHALL be a `PANEL_COPY`
   * entry.** That module exists so a claim is reviewable beside the requirement it serves and a test
   * can read what the panel says without scraping rendered text for it, and a sentence written inline
   * in the component is a claim a reviewer reads in its markup context rather than beside its
   * requirement.*
   *
   * **The one thing every entry below is careful about is what it does NOT say.** The mailbox exists
   * at the provider, and this product is not the provider's authority on when it discards one - so
   * {@link PANEL_COPY.mailboxGone} above exists for a *measured* claim about a provider reporting
   * `expired`, and reusing that wording here would import a claim about a provider into a sentence
   * about a storage area. **Removal deletes this device's note of the mailbox, and nothing else**, and
   * {@link PANEL_COPY.removalDoneMeans} says exactly that.
   *
   * **No entry below names a host or a provider**, for `design.md` D3's reason: this region is read
   * three sections below the host sentence, which already carries the host, and a sentence here
   * naming either would be the second spelling of a rule that lives in `resolve-for-host.ts`.
   */

  /**
   * The heading above the whole region.
   *
   * **It names what the region is about rather than what it will do**, so the heading does not have
   * to change when the region's shape does - it is the one string rendered in all four states.
   */
  removalHeading: "What this device keeps",

  /**
   * **The shape for a device holding nothing, and it is not the same sentence as
   * {@link PANEL_COPY.removalDone}.**
   *
   * `apps/web/src/LocalData.tsx:24` - `:29` gives the reason and it is the requirement's *"SHALL
   * report that it holds nothing"* rather than *whatever the button did*: this sentence is what a
   * first visit always says, and a panel that used it after a removal would leave a person unable to
   * tell whether the press had worked. **It names no address and no provider**, because this device
   * is known to hold nothing and there is nothing to name.
   */
  removalHoldsNothingYet: "This device keeps nothing for SpectreMail.",

  /**
   * **The control that offers the removal, and it names the scope rather than one record.**
   *
   * *Requirement: ... **it SHALL NOT be removed by naming the record kinds this build recognises.***
   * A button reading "Remove this address" beside four record kinds over one area would name one of
   * them, so this names **everything SpectreMail keeps here** - which is what the confirmed step and
   * the warning below both say as well.
   */
  removalOffers: "Remove everything SpectreMail keeps here",

  /**
   * **The irreversibility argument, and it is the whole reason the second step exists.**
   *
   * **It says *cannot be undone* rather than *will ask again*,** because the question after this
   * press is not being asked: a removal that could be confirmed again would not need confirming.
   */
  removalConfirmWarning:
    "This cannot be undone. Everything SpectreMail keeps on this device goes with it, including every address saved here.",

  /**
   * **The control that removes, and it exists only in this shape.**
   *
   * *Requirement: ... **the control that performs the removal SHALL exist only after a further
   * explicit step** - a panel whose removal control was present before the further step would make
   * the confirmation a formality.*
   */
  removalConfirm: "Remove everything now",

  /**
   * **The control that backs out, and it is a control rather than the absence of one.**
   *
   * The website's shape (`LocalData.tsx:135` - `:172`) offers the same second button and for the same
   * reason: a confirmed region whose only way on is forward is a dialog in all but name, and the
   * person who pressed the wrong control needs a way back that is as visible as the one forward.
   */
  removalKeep: "Keep what is here",

  /** While the removal is in flight, on the control that started it. */
  removing: "Removing what this device keeps",

  /**
   * **A refusal, and it says the removal did not happen and nothing else.**
   *
   * *Requirement: **WHEN** removal fails **THEN** the panel SHALL say it did not happen **AND** it
   * SHALL NOT describe the data as removed **AND** it SHALL NOT state that the data remains.*
   *
   * **Both halves of the second and third clauses are the reason this is one sentence with nothing
   * after it.** The website's refusal copy tells a person to close another SpectreMail tab, and that
   * is true *only* of `deleteDatabase`, whose blocked removal is queued and completes on its own -
   * `packages/storage/src/chrome.ts:218` records that `chrome.storage` provides no `deleteDatabase`
   * and therefore no blocked-removal event at all. **On this substrate a rejection is the whole
   * answer**, so a sentence in either direction would be inventing one.
   *
   * **The platform's own words are interpolated and never summarised**, for the same reason
   * {@link PANEL_COPY.providerFailed} does it: a paraphrase of a refusal is a sentence this product
   * invented while describing the platform's failure.
   */
  removalRefused: (reason: string): string => `This did not happen. The browser said: ${reason}`,

  /**
   * **The shape after a removal has happened, and it is not
   * {@link PANEL_COPY.removalHoldsNothingYet}.**
   *
   * **The distinction is a requirement in its own right**, and it is the direction the reporting goes
   * in: this sentence answers *"did that work?"* while {@link PANEL_COPY.removalHoldsNothingYet}
   * answers *"is there anything here?"* - and a panel that answered the first with the second would
   * leave a person who just pressed a button unable to tell.
   */
  removalDone: "Nothing is kept on this device for SpectreMail now.",

  /**
   * **What the removal was, and - in the same sentence - what it was not.**
   *
   * *Requirement: **AND** it SHALL say the address still works until the provider discards it **AND**
   * it SHALL NOT state or imply that the address itself is gone.*
   *
   * **Three facts in one sentence, and each is load-bearing.** That this device's **note** was
   * removed, so a later visit will not offer that address back; that the **address itself** still
   * works, until the provider discards it - which is a claim about the provider's own lifetime, made
   * as the limit of what is known rather than as a figure; and **what was removed is not the mailbox**,
   * which is why this sentence is the one a `removalDoneMeans` reworded into *"the address is gone"*
   * has to be caught by.
   */
  removalDoneMeans:
    "This device's note of the address was removed, so a later visit will not offer it back. The address itself still works until the provider discards it.",

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
 * function-valued entry"** — nine entries here are functions, four of them about a *host*, and a
 * chooser defined as "the function-valued ones" would sweep `hostHasMailbox` into a rule about the
 * chooser and then fail on the very host it is supposed to leave alone.
 */
export const PANEL_CHOOSER_KEYS = ["heldGroup", "chooseMailbox", "showingMailbox"] as const;

/**
 * What the panel says about what the session found in one message, for every verdict there is.
 *
 * ## Why these are the panel's words and not `POPUP_COPY`'s
 *
 * **`extension-client` forbids exactly two surfaces from stating this, and both clauses name the
 * popup** - *"The popup SHALL NOT indicate that a message carries a verification until it has opened
 * that message"*, inside the requirement headed *"The extension's popup performs its first
 * milestone's actions over the shared session"*. **A sentence in `POPUP_COPY` would be a string the
 * website's `Extension preview` depiction could claim the popup renders**, and the popup does not.
 * That is the same cousin as `popup-copy.ts`'s own rule - *a depiction can only show a string, so a
 * function-valued entry is one no depiction may claim to render* - and the caller supplies these the
 * way it supplies `links` and `clipboard`.
 *
 * ## Why this is the website's scheme and not a second one
 *
 * **`apps/web/src/InboxRow.tsx` already renders this same union with an exhaustive record**, and its
 * own docstring gives three reasons the marking is text: a screen reader announces it, it survives a
 * monochrome display, and it survives the stylesheet. **Two clients rendering one shared union
 * differently is exactly the divergence a closed record exists to prevent**, so the strings are
 * ported rather than reworded, and a case reads both.
 *
 * ## What is deliberately NOT ported, and this is a narrowing rather than an omission
 *
 * **`apps/web`'s closed positive set `CARRIES_VERIFICATION` is not here.** Its only consumer is the
 * website's accent rule, whose own docstring says the omission is protecting - *"a rule beside a row
 * is a claim that something is in it"* - and **this panel's rows carry no accent rule and none is
 * added**. A named set with no consumer is a second thing to keep in step, which is the reason this
 * module exists. **If a future slice gives the panel's rows a visual claim, the closed set becomes
 * load-bearing and this narrowing must be revisited then.**
 *
 * ## Why `carriesNothing` is written out as `""` rather than omitted
 *
 * **Because "the row shows no marking" is a decision here and not a missing case**, and an omitted
 * key would compile. `Readonly<Record<MessageVerdict["kind"], string>>` means **a sixth verdict
 * fails to compile at this line**, which is the type doing the work a test would otherwise have to.
 *
 * @module
 */
export const PANEL_VERDICT_WORDING: Readonly<Record<MessageVerdict["kind"], string>> = {
  /**
   * A detected one-time code and nothing else.
   *
   * *Scenario: **A message carries a detected verification** - "the marking SHALL name which was
   * detected rather than naming both."*
   */
  carriesCode: "Contains a one-time code.",

  /**
   * A detected verification link and nothing else.
   *
   * *Scenario: **A message carries a detected verification** - the same "which, rather than both".*
   */
  carriesLink: "Contains a verification link.",

  /**
   * Both detections, named as both.
   *
   * *Scenario: **A message carries a detected verification** - the requirement's first sentence,
   * "a detected one-time code, a detected verification link, **or both**".*
   */
  carriesCodeAndLink: "Contains a one-time code and a verification link.",

  /**
   * The message **was** read whole and no verification was detected in it.
   *
   * **The empty string, and that is the whole of the claim.** *Scenario: **A message was read and
   * carries nothing** - "the panel SHALL carry no marking on that row"*, and it is also the second
   * half of *"the panel SHALL NOT state that the message carries no verification"*: the silence is
   * the answer, because `carriesNothing` says the message was read and held nothing, which is not
   * the same claim as "there is provably no code in it". **This is the only verdict with no words,
   * and it is the one where a sentence would have to be a stronger claim than any specification
   * here supports.**
   */
  carriesNothing: "",

  /**
   * The session has **not** determined this message.
   *
   * **Words on its own row, and this is the claim this panel exists to make.** *Scenario: **A
   * message could not be determined** - "that message's row SHALL carry a marking stating that the
   * message could not be read"*, and it also discharges *"a message the session has not determined
   * SHALL NOT be presented as carrying a detection"* in words rather than by a rule nobody would see.
   *
   * **It says what the session does not know and never what the message holds**, so it is true
   * whatever the message contains - `state.ts` names collapsing it into a negative as the one false
   * claim in this product that costs a user the code they were waiting for. *Scenario: **A check
   * failed and the last known listing is shown** - "a row whose message was read SHALL NOT be marked
   * as a message that could not be read"* - is discharged by the map itself, because a message the
   * session did read is not in it and is therefore not `undetermined`.
   */
  undetermined: "This message could not be read, so what it carries is unknown.",
};
