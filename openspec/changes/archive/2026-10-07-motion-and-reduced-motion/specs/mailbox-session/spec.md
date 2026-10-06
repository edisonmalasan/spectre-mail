# Spec Delta

## ADDED Requirements

### Requirement: A check in progress keeps the messages the last check learned

While a listing request is in flight, the session's inbox SHALL report the messages and
verdicts the previous check learned, and SHALL report nothing it has not learned. A
caller that renders a listing while a check runs SHALL therefore be able to keep showing
those messages rather than replacing them, and the first check of a mailbox — which has
learned nothing — SHALL report no messages.

**Amendment, recorded during apply (2026-10-06).** This requirement did not exist when the
change was proposed, and it is not a refinement of one. `motion-and-reduced-motion` landed
an entrance animation on an inbox row, and its own browser spec found the implementation
violating the change's third `visual-system` requirement: **every poll removed the inbox
list and rebuilt it.** `InboxState`'s `checking` variant carried no listing, so it was the
one variant that could leave a client with nothing to show for the length of a request, and
the website client rendered it as its own branch. Measured on the built page in Chromium,
with a `MutationObserver` recording every node added and removed:

```text
5153ms DOM -[UL.inbox-rows]
5153ms DOM +[P.]
5156ms DOM -[P.]
5156ms DOM +[UL.inbox-rows]
5187ms START materialise on inbox-row
```

A poll removed the list, inserted a sentence, and put the list back, and the rebuilt row
re-ran its entrance — every five seconds, for as long as the tab stayed open. The harm
was not only motion: focus inside the list was destroyed, hover and text selection were
lost, and the same flash was already visible to a user who had asked for no motion at all.

**`checkFailed` already kept the last known listing**, and the reason `state.ts` gives for
it — *"a failed check is a condition of the inbox, not the loss of it"* — applies here with
more force, because "is being checked" is a weaker reason to hide what is known than "the
check failed". The two variants behaving differently had no stated reason; this requirement
supplies one.

**The repair was chosen over a client-side cache, and the reason is recorded because it
was a real fork.** `Inbox.tsx` states that it is *"presentational and nothing else"* and
that *"every judgement about what is true belongs to the session"*. Retaining the last
listing in the client would have been a smaller diff and would have made the list's
identity a fact the presentation layer remembered, duplicating what the session already
owns and putting a what-is-true judgement in the layer that disclaims having one. Widening
the change to this capability was the deliberate cost.

#### Scenario: A mailbox that already has a listing is checked again

- **WHEN** a listing is requested for a mailbox whose previous check learned messages
- **THEN** the state reported while the request is in flight SHALL carry those messages
- **AND** it SHALL carry the verdicts for them
- **AND** it SHALL carry no message that no check has reported

#### Scenario: The first check of a mailbox

- **WHEN** a listing is requested for a mailbox no check has succeeded for
- **THEN** the state reported while the request is in flight SHALL carry no messages
- **AND** it SHALL carry no verdicts

#### Scenario: The listing in flight arrives

- **WHEN** the request being waited on completes
- **THEN** the state reported SHALL replace the one held while it ran
- **AND** a failed request SHALL report the same messages, by the same rule, rather than
      emptying the inbox

#### Scenario: A caller keeps what it was given

- **GIVEN** a caller rendering a listing
- **WHEN** the session reports that a check is in flight
- **THEN** the messages it was given SHALL still be reportable from that state
- **AND** no caller SHALL have to remember a previous state to render the current one