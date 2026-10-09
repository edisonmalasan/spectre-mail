# Proposal

## Why

The extension can put an address into somebody else's signup form, and `verification-actions`
gave the **website** the two actions a detected verification invites — copy the code, open the
link. The extension can do neither, and it cannot do either **because it never sees a code**: its
popup renders a *count* of messages and discards everything else, because `MessageSummary`
carries no detection at all — `packages/core` states that codes and links are absent from a
summary "on purpose: listing a mailbox must not require fetching bodies".

So a person who installed SpectreMail to get through a signup is still copying a six-digit code
by hand, in the one flow the product exists for. This change gives the extension the same two
answers the website has, restricted to the one the roadmap scopes to a user action: **a code the
user has seen can be put into the page's own one-time-code field, on their activation, and never
otherwise.**

## What Changes

- **The popup lists the messages in the mailbox it already holds** and, for a message the user
  opens, **shows the one-time codes detected in it** — read through the shared session's
  `openMessage`, so no provider request is made for a message this session has already analysed.
- **A detected code can be put into a one-time-code field on the open page**, on the user's
  activation of a per-code control in the popup. Nothing fills a field without that activation.
- **The in-page client recognises a one-time-code field** from named signals only, prefers a
  field that identifies itself as such, and **asks rather than guesses when several qualify**.
- **The form is never submitted, and the insertion reaches the page's own state** by the same
  mechanism the address insertion already uses and `in-page-integration` already requires for it.
- **`extension-client`'s declared absence of a one-time-code control is amended**, in the form
  that absence's own scenario requires of the milestone that adds it, rather than deleted. The
  side panel, the notification, and the verification-link control **stay on that list**.
- **No background polling, no new permission, and no new storage record** are introduced. The
  measurement that makes the first two possible is recorded in `design.md` D1.

**Deliberately not in this change**, named because each is on the roadmap's own list of M10 user
actions and its absence here would otherwise read as an oversight:

- **"Copy code" in the popup.** `verification-actions` delivered copy on the *website*; the
  popup's copy control is a separate surface with a separate clipboard story, and adding it here
  would make this slice two user actions rather than one.
- **"Open verification link" in the popup.** It needs the same opened-message plumbing this
  change builds, and it is still a separate user action with its own "show the destination host"
  rule.
- **Arrival notification.** It requires `alarms` and `notifications`, and it reverses
  `extension-client`'s committed no-polling rule. The reasoning and the measured reasons it was
  rejected are in `design.md` D2.

## Capabilities

### New Capabilities

None. This change extends two capabilities that already exist, and a new one would split a
surface the repository has deliberately kept in two: `extension-client` owns what the popup is,
`in-page-integration` owns what is drawn inside somebody else's page.

### Modified Capabilities

- `extension-client`: the declared-absence requirement is amended to take the one-time-code fill
  control off the list while leaving the side panel, the notification, and the verification-link
  control on it; and the popup requirement is amended so the popup's mailbox section reports the
  messages it found rather than only how many there were.
- `in-page-integration`: the email-affordance requirement is amended to say that its focus rule
  governs the *email* affordance and that a code delivery is a different act with a different
  trigger; the "becomes the value the page's own state holds" requirement is broadened from *the
  address* to *any value this extension inserts*, because that is one property with two callers;
  and four requirements are added — recognising a one-time-code field, delivering only on
  activation and never the form, asking when several fields qualify, and reaching the page without
  a permission the extension does not already hold.

## Impact

**Code.** `apps/extension/src/Popup.tsx` gains a message list and a per-code control;
`popup-copy.ts` gains the sentences those render; `protocol.ts` gains **one** request/answer pair
for delivering a code to a tab; a new module recognises one-time-code fields beside the existing
`email-field.ts`; `content-script/insert.ts` is generalised from *an address* to *a value* rather
than duplicated.

**Unchanged, and named because each was the obvious place to look.** The service worker is not
involved — the popup talks to the content script directly, so `extension-client`'s no-polling
requirement is untouched and no alarm is created. `static/manifest.json` is **not edited**: the
delivery needs no permission this extension does not already hold (`design.md` D1). No package
changes: `openMessage`, `analyseMessage`, and the detection types are all already exported.
`packages/ui` is untouched — no new token and no new motion, so its test count must not move.

**Risk.** The in-page half runs on pages this repository has never seen. `packages/mail-parser`'s
corpus is authored, not captured, and no verification mail from any service has ever been received
here, so "a page marks its one-time-code field the way the fields this change recognises do" is
an assumption with an authored fixture behind it and nothing else. That limit is stated in the
requirements rather than left to be discovered through a signup form.
