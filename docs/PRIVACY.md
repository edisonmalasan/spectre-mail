# Privacy

This document states what SpectreMail keeps, what it reaches, and what it does not
collect. It is the one place those facts are written down; the website's footer,
its local-data region and the extension's side panel each restate a part of it, and
a check in `tests/architecture/privacy-disclosure.test.ts` holds those restatements
to this file.

It is **not** a legal document. No jurisdiction has been considered and no
compliance regime is named, because naming one would be the single claim in this
repository with the least evidence behind it.

**Read the first section first.** Of everything listed here, one record is the kind
of thing a privacy document that omitted it would be _worse_ for not publishing:
the set of hostnames a SpectreMail address was used on.

---

## 1. What this device keeps — the browser extension

The extension keeps **four** kinds of record, all in the browser's
`chrome.storage.local` area. Nothing else is written outside the page, and nothing
is sent anywhere to keep them.

| key in `chrome.storage.local` | what it holds                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `current`                     | One mailbox record: the address, the provider that issued it, and the credentials for it.                                                                                                        |
| `mailboxes`                   | The mailboxes this device holds, newest first.                                                                                                                                                   |
| `site-mailboxes`              | A map from a page's hostname to the mailbox id used there. Read [below](#9-the-hostname-association-in-full) — this is the record a privacy document that left it out would be misleading about. |
| `seen-messages`               | The ids of messages this device has already announced, keyed by mailbox. No sender, no subject, no body.                                                                                         |

**Only the hostname is retained for `site-mailboxes`**, and four qualifiers are
load-bearing rather than reassuring.

- **The hostname alone.** No registrable-domain folding: `a.example.com` and
  `b.example.com` are two different keys, not one. No URL, path, query string,
  page title or form content is kept. The query string is the part that matters
  most, because a sign-up link's token is usually in it.
- **Written only after an insertion lands.** Offering a control inside somebody
  else's page records nothing. The record is written when an address is actually
  inserted into that page, never when one is merely on offer.
- **One mailbox id, not the address itself.** The value is an identifier; the
  address is already in `mailboxes`.
- **Removed with everything else.** There is no control that removes this
  association on its own. It goes when the whole storage area goes — see
  [Making this device forget](#5-making-this-device-forget).

## 2. What this device keeps — the website

The website keeps **one** kind of record, in IndexedDB.

| database       | object store | key       | what it holds                                                                             |
| -------------- | ------------ | --------- | ----------------------------------------------------------------------------------------- |
| `spectre-mail` | `mailbox`    | `current` | One mailbox record: the address, the provider that issued it, and the credentials for it. |

**There is no copy of it on a server**, because there is no server. There is no
sign-in, and no record of who is signed in.

## 3. What providers receive

**Each client reaches a different set of provider origins, and the difference is
not a preference.** Mail.tm serves CORS headers only to its own origins, so a
normal web page cannot reach it at all; a browser extension holds host permissions
and can. Reachability is a property of where the code runs.

| client    | provider origins it reaches                            |
| --------- | ------------------------------------------------------ |
| Website   | `https://api.guerrillamail.com`                        |
| Extension | `https://api.mail.tm`, `https://api.guerrillamail.com` |

**A provider receives your mail.** An address created through SpectreMail is an
account at that provider, and the mail arrives there before any client of ours
sees it. Reading a message means asking the provider for it.

**SpectreMail operates no server and relays nothing.** There is no proxy in front
of either provider, and there never will be — not to work around a CORS
restriction, and not for any other reason.

**No SpectreMail page, popup or panel loads anything from another origin.** There
is no analytics script, no font CDN, no crash reporter and no embedded content.

## 4. What SpectreMail does not collect

Each entry below names the thing in this repository that supports it. **Grounding
is not completeness.** A resolvable pointer proves the claim is backed by a
promoted requirement, a recorded measurement, or a rule this project holds itself
to. It does **not** prove that nothing else is collected: proving the absence of a
shipped surface cannot be enumerated from the tree without becoming a second
boundary suite. Read this list as _these claims are checkable_, not as _nothing
else exists_.

| what SpectreMail does not collect                                                                      | what supports it                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| No SpectreMail-operated server, and no provider request is ever relayed through one.                   | `openspec/specs/provider-abstraction/spec.md#requirement-provider-apis-are-never-proxied`                                              |
| No account, no sign-up step, and nothing about the user is asked for.                                  | `openspec/specs/website-client/spec.md#requirement-the-website-creates-a-mailbox-without-asking`                                       |
| No third-party asset from any origin: no font, no script, no image, no embedded content.               | `openspec/specs/visual-system/spec.md#requirement-the-page-loads-no-third-party-asset`                                                 |
| Nothing of a page beyond the hostname the extension is beside — no URL, no form, no field, no content. | `openspec/specs/in-page-integration/spec.md#requirement-the-content-script-reports-the-host-it-is-beside-and-nothing-more-of-the-page` |
| No message body, read merely to list a mailbox. A body is fetched only when you open that message.     | `openspec/specs/mailbox-session/spec.md#requirement-a-listing-for-a-caller-that-displays-nothing-reads-no-message-body`                |
| No persisted state anywhere outside the two areas named in sections 1 and 2.                           | `openspec/specs/spectre-storage/spec.md#requirement-persistence-is-reached-through-one-contract`                                       |

**A hostname association _is_ kept**, and section 1 names it. It is the only
record here that names a site, and it is listed rather than folded into a sentence
about what is not collected.

## 5. Making this device forget

**Both clients offer the same control, in the same shape: two steps, and the first
press removes nothing.** The second press is what removes. This is not a
confirmation dialog — it is a second control the person has to find and press.

| step      | what it does                                                         |
| --------- | -------------------------------------------------------------------- |
| `offer`   | Offers the removal and says what would go. Nothing has been removed. |
| `confirm` | Removes the whole storage area, and says what is left.               |

**What is removed is the whole area, not a named key.** Not the current mailbox
record, not the collection, not the hostname association by name — the whole
thing. A record kind added by a later build is removed by the same control,
because the control does not enumerate the record kinds this build knows about.

**What removal leaves behind is the address itself.** Removal deletes _this
device's note_ of the address. The address continues to exist at the provider and
continues to receive mail until the provider discards it, which is not something
SpectreMail decides or can tell you the date of.

**If the browser refuses, that is what is reported.** A removal that did not happen
is said not to have happened, in the browser's own words. It is not reported as a
success, and it is not reported as safe — on the website's IndexedDB store a
refused removal stays queued and completes on its own once the other tab holding
it closes, so neither half would be a promise this product could keep.

## 6. Provider attribution

**Neither provider's attribution requirement has been established, and this
document does not resolve it in either direction.** Saying "no attribution is
required" would be exactly as unsupported as saying one is.

| provider       | what was actually verified                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mail.tm        | **No terms page exists.** `https://mail.tm/terms` returns 404, and the FAQ carries no proxy, resale, attribution or quota terms. Checked 2026-10-02. |
| Guerrilla Mail | **Nothing this repository found.** Its public API terms, rate limits and attribution requirements were not located and were not re-verified.         |

Earlier revisions of this project quoted Mail.tm terms requiring attribution.
**Those quotations could not be located and are withdrawn.** See
`docs/PROVIDERS.md#2-mailtm` and `docs/PROVIDERS.md#3-guerrilla-mail` for the
measurements behind both rows.

## 7. Message lifecycle limitations

A provider's figure and a figure measured by this project are different things,
and the table says which is which. **Nothing in this repository has held a mailbox
open long enough to observe either horizon**, so every row below is a published
statement or an absence.

| figure                                  | value                     | status     |
| --------------------------------------- | ------------------------- | ---------- |
| Mail.tm message retention               | 7 days                    | published  |
| Mail.tm mailbox lifetime                | valid until you delete it | published  |
| Guerrilla Mail inbox and session expiry | none known                | unmeasured |

`published` means the provider states it and this project has not verified it
against the live API. `unmeasured` means neither the provider nor this project
has a figure. **Neither value appears in any provider's API response**, so no
client can discover it, and no countdown is derived from it: expiry is decided by
an observed signal, never by elapsed time.

Because a provider holds the mail, **the provider's own retention is what applies
to your message**, and you cannot see or change it from here.

**Temporary addresses are disposable by design.** Anything sent to one is readable
by whoever holds the address, so it must not be used for anything that matters.

---

## 8. What the browser extension asks for

Four permissions are declared in the extension manifest. Each is needed for a
feature a person can see.

| permission      | the feature that needs it                                                     |
| --------------- | ----------------------------------------------------------------------------- |
| `storage`       | Keeping the four records in section 1, and the removal in section 5.          |
| `alarms`        | Waking in the background to announce mail that arrives while nothing is open. |
| `notifications` | Showing that announcement.                                                    |
| `sidePanel`     | The panel you can dock beside a page and read the mailbox in.                 |

**Host permissions** are limited to the two provider origins in section 3. No
other origin is reachable by the extension.

## 9. The hostname association, in full

Repeated from section 1 because it is the record whose omission would make this
document's existence misleading.

**What it is.** A map, held in `chrome.storage.local` under the key
`site-mailboxes`, from a page's hostname to the id of the mailbox an address was
inserted on that page.

**When it is written.** Only after an insertion actually lands in that page's
field. A control being offered records nothing; a tab being visited records
nothing; a field taking focus records nothing.

**What it contains.** The hostname, and a mailbox id. The exact hostname, with no
registrable-domain folding. No URL, no path, no query string, no page title, no
form contents, no field name, no value typed into anything.

**Why the hostname and nothing else.** A page has to be able to be recognised to
be offered the address it was last used with. The hostname is the smallest thing
that does that job, and it is not the part of a URL that carries a token.

**How long it lasts.** Until the whole storage area is removed. There is no
per-site removal, and no time limit on it.

**What it is not.** It is not a browsing history: it holds no page you visited,
no sequence, and no timestamp. It is a map from a hostname to a mailbox id, and
nothing else.

---

_Facts, not reassurance. Where this document says something is unmeasured, it is
unmeasured; where it names an absence, the absence is the finding._
