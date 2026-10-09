/**
 * Website client root component.
 *
 * ## What this milestone is, and is not
 *
 * M5 slice 2 added the inbox; M6 slice 2 added reload recovery. This is **structure,
 * not design** — there is no stylesheet, no design token, and no layout system here,
 * and that is deliberate. The visual milestone owns those, and building them now would
 * produce markup it rewrites. The approved design skills are not applied at this
 * milestone.
 *
 * The page states only what is true:
 *
 * - It reaches **one** provider, for the measured CORS reason recorded in
 *   `provider-config.ts`. It does not claim redundancy it does not have, and it
 *   offers no provider selector, because a selector offering only one reachable
 *   provider is a control that cannot do anything. That absence is a **requirement**
 *   rather than an opinion this file happens to hold: `website-client` states that the
 *   website offers no control for choosing a provider, names the provider it reaches,
 *   and does not describe the absence as missing or forthcoming. Before this it was
 *   only a comment here, and `App.test.tsx` had to guard the condition itself.
 * - It **shows no cadence**. It says that it checks while the page is open, and never
 *   how often — no provider limit was measured for the only provider a browser page
 *   can reach, so any figure would be an invention presented as a measurement.
 * - **It keeps this device's address, and it can be made to forget it.** One mailbox is
 *   written to this browser's own storage and offered back on the next visit, after the
 *   provider confirms it. `LocalData` states what is kept, where, and offers a confirmed
 *   removal — so this page no longer has the property slice 2 documented about it and
 *   could only apologise for, which was that it stored an address and offered no way to
 *   take it back. That sentence in the limits list is **gone rather than reworded**;
 *   the comment where it stood records why, because a stale claim that reads like a
 *   security guarantee is the most damaging kind of wrong on a page.
 * - **A removal that is refused is reported as refused.** A second SpectreMail tab
 *   holding the database leaves the removal queued rather than cancelled, so the page
 *   says it did not happen and says nothing at all about whether the record survives —
 *   see `LocalData`'s note, which sets out both halves of that.
 * - **A stored address is never shown as working before the provider says so.** That
 *   is what `docs/PROVIDERS.md` §3's measured trap makes necessary: an unrecognised
 *   Guerrilla Mail session answers `HTTP 200` with an empty inbox and no error, so
 *   "nothing has arrived" and "this address is gone" are the same response.
 * - **Opening a message shows it, and acts on it only when asked.** A message's readable
 *   text, its one-time code candidates, and its verification links are displayed, and each
 *   code and each link now carries a control. **Rendering still does nothing by itself**:
 *   copying a code and opening a link happen because somebody activated something, and a
 *   link that navigated because a message had been rendered would be a side effect of
 *   reading someone's mail. `website-client`'s *`A detection is acted on only when the user
 *   asks`* states that, and it replaced the older requirement this bullet used to name —
 *   *"This slice shows what it found and does not act on it"* — which this slice REMOVES,
 *   because two of the three things it prohibited are what this page is for. `design.md` D1
 *   records why, including the conflict between this roadmap's M5 acceptance criteria and
 *   `AGENTS.md`'s assignment of OTP copy to the verification workflow milestone.
 * - **No confidence number is shown for a detection.** The parser produces a judgement
 *   traceable to a published rule, not a probability, and a bare `0.85` would be read
 *   as an 85% chance of being right.
 * - No backend is involved, and SpectreMail never proxies a provider API.
 *
 * ## Each state is distinct in words, not in colour
 *
 * All seven `SessionState` variants render their own heading and their own prose, and so
 * do the two storage facts and the inbox's four states. No state is signalled by
 * styling alone, so nothing here depends on colour being perceived or a stylesheet
 * having loaded.
 *
 * ## Why `blocked` alone gates the session
 *
 * `boot` has three values and only one of them hides the session.
 *
 * **`blocked` is the safety gate.** A page that cannot read its own storage has never
 * asked the session to do anything, so there is nothing on screen that could be
 * mistaken for a mailbox — and showing a "no address yet" heading over it would be a
 * claim the page cannot support.
 *
 * **`reading` is not a gate, and this file got it wrong first.** It originally
 * rendered nothing but a "looking for a saved address" region while the read was out,
 * on the reasoning that rendering `idle` then would be a lie. It is not a lie: a
 * session that has not been asked for anything *is* the page deciding whether to ask
 * it, and the copy is the same sentence. The cost of the extra gate was that
 * `SessionState`'s `idle` became **unreachable in the only client that renders
 * session states** — `boot` moved to `started` in the same microtask that `restore`
 * published `adopting`, so React batched them into one render and `idle` never
 * appeared. A requirement to render a state the page cannot be in is a requirement no
 * test can satisfy, so the gate and the requirement were both wrong.
 *
 * Rendering the session while the read is out is safe for a reason that is worth
 * stating, because it is not obvious: the session is only ever asked to do something
 * *after* a successful read, so during `reading` it cannot hold a mailbox. The only
 * way to reach an address-bearing state before the page knows what it has is a
 * successful read followed by a failed restore, and that is `restoreFailed` — which
 * names the address as unconfirmed rather than presenting it as working.
 *
 * @module
 */

import { useState } from "react";

import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxSession, OpenedMessageState } from "@spectre-mail/mailbox";

import { Address } from "./Address";
import { BootFailure } from "./BootFailure";
import { Inbox } from "./Inbox";
import { LocalData } from "./LocalData";
import { MailboxFailure } from "./MailboxFailure";
import { MailboxLifetime } from "./MailboxLifetime";
import { MessageView } from "./MessageView";
import { PageFooter } from "./PageFooter";
import { Reasons } from "./Reasons";
import { ExtensionPreview } from "./ExtensionPreview";
import { createWebsiteProviderManager } from "./provider-config";
import { webScheduler } from "./scheduler";
import { Steps } from "./Steps";
import { Wordmark } from "./Wordmark";
import { useWebsiteStorage } from "./storage";
import type { WebsiteStorage } from "./storage";
import { StoredAddressGone } from "./StoredAddressGone";
import { StoredAddressUnchecked } from "./StoredAddressUnchecked";
import { useInboxVisibility } from "./useInboxVisibility";
import { useMailboxSession } from "./useMailboxSession";

/**
 * The id of whatever is open, or `null` when nothing is.
 *
 * **Extracted rather than read three times at the call site**, because the three
 * consumers must agree: a retry that re-opened a *different* message than the one that
 * failed would report a fresh failure against a row the user never touched, and reading
 * the id inline three times is three chances to write one of them wrongly.
 */
function openedMessageId(opened: OpenedMessageState): string | null {
  return opened.kind === "opening" || opened.kind === "openFailed" ? opened.messageId : null;
}

export interface AppProps {
  /**
   * The session to render.
   *
   * A parameter rather than something built inside the component, so a test can
   * supply a session over a stub provider and assert the page's behaviour without a
   * network. Production leaves it unset and gets the real one.
   */
  readonly session?: MailboxSession;
  /**
   * The storage to read and write, or the reason there is none.
   *
   * **Injected for the same reason as `session`, and it is not optional in practice.**
   * A default built by calling a factory in the component body would produce a new
   * storage — and re-run the read — on every render, so the default goes through
   * `useWebsiteStorage`, which builds it once. A caller that already has one uses it,
   * and the hook still runs: a hook called only when a prop is absent is a hook whose
   * call order changes with its props.
   */
  readonly storage?: WebsiteStorage;
}

export function App({ session, storage }: AppProps = {}) {
  // **Both built once.** Calling `createMailboxSession` in the component body produced a
  // *new* session on every render, which was harmless while the session only ever held
  // a mailbox and quietly wrong now: the binding keys its first listing on the
  // mailbox's id, so a fresh session per render would reset the poller — and its
  // verdict cache — on every state change. A fresh storage per render is the same
  // hazard one layer out, and it additionally re-reads the store.
  const [ownSession] = useState(() =>
    createMailboxSession(createWebsiteProviderManager(), webScheduler),
  );
  // **Unconditional, and then chosen between.** `useWebsiteStorage` is called whether
  // or not a `storage` prop arrived, because a hook whose call order depends on its
  // props is the failure React's rules exist to prevent — and because the builder never
  // throws: where the platform has nothing, the result is `blocked` and the injected
  // value is used instead.
  const ownStorage = useWebsiteStorage();
  const active = session ?? ownSession;
  const store = storage ?? ownStorage;
  const {
    state,
    boot,
    saving,
    localData,
    clearStored,
    retryBoot,
    startFresh,
    retry,
    replace,
    checkInbox,
    openMessage,
    closeMessage,
  } = useMailboxSession(active, store);

  useInboxVisibility(active);

  return (
    // **A fragment, because the footer is a page-level landmark and must not be a
    //   descendant of `<main>`.** ARIA forbids `contentinfo` inside `main`, and that is
    //   not a formality — Chromium was measured on 2026-10-06 exposing this footer as
    //   `sectionfooter` with **zero** `contentinfo` landmarks, while jsdom's role mapping
    //   said `contentinfo` and `App.test.tsx` passed. The first version of this change
    //   put the footer inside `<main>` and the client suite was green on a role no user
    //   would ever receive. A substitute platform hid the defect; the platform named it.
    //   The footer is a sibling of the page's main content, which is also where it reads
    //   correctly: it is about the page, not about one section of it.
    <>
      <main>
        {/* **The product is the first region**, and the wordmark carries the brand mark beside
          it rather than above the address. The roadmap's first section is a *live product
          hero* and the roadmap then says *"The product itself should remain the main hero"*;
          both hold because there is no marketing block between here and the address. */}
        {/* **No class hook, and the one this carried first is gone.** It read
          `className="product"` with nothing in `styles.css` matching it — and a hero needs no
          rule of its own to be first on the page. `data-region="product"` is what the order
          assertion reads this section by, and it is the hook that earns its name. Caught by
          the boundary rule *"uses every class hook a client renders"*, which is the rule's
          whole purpose: a hook added to a component and never styled. */}
        <section aria-labelledby="product-heading" data-region="product">
          <Wordmark />
          <p className="page__lead">Temporary email for the web and the browser.</p>

          {boot.kind === "blocked" && <BootFailure reason={boot.reason} onRetry={retryBoot} />}

          {boot.kind !== "blocked" && state.kind === "idle" && (
            // **This region is also the page's "looking for a stored address" state**, and
            // the two are the same moment: a session that has not been asked for anything
            // is a session the page is still deciding whether to ask. Gating it behind
            // `boot === "started"` — which is what this file did first — made `idle`
            // unreachable, and a requirement to render a state the page cannot be in is a
            // requirement no test can satisfy.
            //
            // **Safe to render the session while the read is still out**, and it is
            // `blocked` alone that does the gating. The session is only ever asked to do
            // something *after* a successful read, so during `reading` it cannot hold a
            // mailbox; the only way to show an address before the page knows whether it
            // has one would be for the read to succeed and the restore to fail, and that
            // reaches `restoreFailed`, which shows the address as unconfirmed.
            <section className="region" aria-labelledby="idle-heading">
              <h2 id="idle-heading">Looking for a saved address</h2>
              <p data-testid="idle">Checking what this device has stored.</p>
            </section>
          )}

          {boot.kind !== "blocked" && state.kind === "creating" && (
            // No address here either, for the same reason as above.
            <section className="region" aria-labelledby="creating-heading">
              <h2 id="creating-heading">Creating your address</h2>
              <p data-testid="creating">Asking Guerrilla Mail for a new address.</p>
            </section>
          )}

          {boot.kind !== "blocked" && state.kind === "adopting" && (
            // **Its own heading, not `creating`'s.** This is the slowest request a
            // returning visitor waits through, and the copy difference is the whole reason
            // `adopting` is a state rather than a flag: this page is checking an address the
            // user already has, not asking for a new one.
            <section className="region" aria-labelledby="adopting-heading">
              <h2 id="adopting-heading">Checking your saved address</h2>
              <p data-testid="adopting">
                Asking Guerrilla Mail whether the address stored on this device still works.
              </p>
            </section>
          )}

          {boot.kind !== "blocked" && state.kind === "ready" && (
            <section className="region" aria-labelledby="ready-heading">
              <h2 id="ready-heading">Ready</h2>
              <p data-testid="ready">Your address is below. Nothing was required to create it.</p>
              <Address mailbox={state.mailbox} />
              {/*
            **A failed write is announced next to the address, not in the failure region
            or the limits list.** The address on screen is real and usable; what is in
            doubt is whether it will be here next time, and that is a different claim
            from anything else on the page. Hiding it in a list at the bottom would be a
            way of saying it without saying it.
          */}
              {saving.kind === "notSaved" && (
                <p className="notice notice--danger" data-testid="save-failed">
                  This address could not be saved to this device, so a reload will not bring it
                  back. {saving.reason}
                </p>
              )}
              <MailboxLifetime mailbox={state.mailbox} />
              {/* Rendered above the inbox, and always: an address the user has to scroll
              to find after a failed check is an address they will assume is gone. */}
              <Inbox inbox={state.inbox} onCheck={checkInbox} onOpenMessage={openMessage} />
              {/* The message view sits *after* the inbox rather than replacing it. A user
              who opened a message to read one code and finds their list gone has to
              come back to find it again, and the inbox is what tells them the message
              arrived at all. Both on screen also means the "back" control has somewhere
              real to go back to. */}
              <MessageView
                opened={state.opened}
                onClose={closeMessage}
                onRetry={() => {
                  // **The id is read here, from the state this render already has.** It used
                  // to be handed to `MessageView` as a prop, on the strength of a comment
                  // promising "a test asserting a retry carries the right id" — and no such
                  // test existed. The independent verification pass found the span it fed had
                  // exactly one reader: the span itself. So the prop and the hidden element
                  // are gone, and this closure is the only place an id is needed.
                  const id = openedMessageId(state.opened);
                  if (id !== null) openMessage(id);
                }}
              />
              {/* **The primary action, and it is filled.**
              The Accent block asks for an accent on a *primary action*, and slice 1
              deliberately deferred this surface because nothing on the page was a primary
              action yet. **This page has no submit** — it creates an address on load — so the
              only control that moves a visitor forward is the one that replaces the address.

              The filled treatment needs an ink the palette did not have: measured against
              `--accent`, no other ink in the palette reaches the body threshold in either
              scheme, so `--ink-on-accent` was declared and paired rather than one being
              borrowed and mislabelled. Nothing else on the page takes the fill —
              `LocalData`'s removal is destructive, and a destructive control wearing the
              product's most emphatic treatment would be a design error. */}
              <button type="button" className="control control--primary" onClick={replace}>
                Replace address
              </button>
            </section>
          )}

          {boot.kind !== "blocked" && state.kind === "expired" && (
            <StoredAddressGone
              mailbox={state.mailbox}
              onRetry={startFresh}
              onReplace={startFresh}
            />
          )}

          {boot.kind !== "blocked" && state.kind === "restoreFailed" && (
            <StoredAddressUnchecked
              mailbox={state.mailbox}
              failure={state.failure}
              onRetry={retry}
              onStartFresh={startFresh}
            />
          )}

          {boot.kind !== "blocked" && state.kind === "failed" && (
            <MailboxFailure failure={state.failure} onRetry={retry} />
          )}

          {boot.kind === "started" && (
            // **Own region, gated on the boot having *finished*, and that gate is the
            // second version of this decision.** It was first written as "anything but
            // blocked", which rendered the region while the read was still out — and the
            // region's honest `none` branch then said *"Nothing is kept in this browser"*
            // on a page that had not yet looked. That is the same class of false claim as
            // `boot: blocked` making the session's `idle` unreachable, one layer down: a
            // branch chosen from a value that has not been established.
            //
            // Two reasons for the gate that replaced it. During the read the page knows
            // nothing, so it may assert neither that something is stored nor that nothing
            // is — and the session's own region is already telling the user a read is in
            // flight, so nothing is left unsaid. And where storage is blocked it does not
            // know either, for the same reason; `BootFailure` says that instead.
            //
            // It renders in **every session state** once the boot is done, because what this
            // browser remembers has nothing to do with what the session is doing — a user
            // looking at a creation failure with a stored address still needs to remove it.
            <LocalData localData={localData} clearStored={clearStored} />
          )}
        </section>

        {/* **The two sections between the product and the footer.**
          Their order is not incidental: the roadmap's sequence puts *what happens* before
          *why*, because a visitor who has just been handed an address has a question about
          what it will do before they have a question about whether to trust it. The order
          itself is data — `PAGE_ORDER` in `sections.ts` — so that "the stated order" is a
          requirement a browser check can read rather than a description. */}
        <Steps />
        <Reasons />

        {/* **The extension, between the reasons and the limits.** It was the fourth section
          the roadmap names and the one this milestone owed last, because until M8 it depicted
          nothing: `apps/extension` held no manifest, so a preview of it would have been a
          picture of a picture. **The placeholder it is now replaces is gone rather than
          reworded** - the note in `PAGE_ORDER` that recorded the section's absence became
          false when the manifest landed, and a reworded version would read as current state.

          It sits after *why* and before *what it cannot do*, which is where a description of a
          second client belongs: the reader has been told what the product does and why it is
          worth using, and the limits are about the product as a whole rather than about the
          extension in particular. */}
        <ExtensionPreview />
      </main>

      {/** The limits moved here unchanged. The storage bullet that used to stand between
          the product and the end of the page was removed rather than reworded at the slice
          that made it false — it stored an address and said no button could take it back —
          and what this device keeps now belongs to `LocalData`, beside the control that
          removes it. */}
      <PageFooter />
    </>
  );
}
