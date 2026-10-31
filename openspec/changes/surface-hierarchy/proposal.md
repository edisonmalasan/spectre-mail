# Surface hierarchy

## Why

**Both clients spend their visual hierarchy on explaining the product rather than on the product, and
the extension throws away the message it just opened.** Those are two sentences about one decision —
*what is this surface's subject, and how much of its emphasis does the subject get* — and they were
measured on the built artefacts in Chromium rather than asserted from taste.

### Measured, here, on 2026-10-28

Every figure below was read from the **built** pages and the **built** extension, at
**1440 × 900** for the website and at the surfaces' own sizes — **352 × 760** for the popup and
**400 × 900** for the panel — driving one fresh mailbox against the recorded provider. The instrument
was a temporary Playwright spec, deleted before this proposal was committed, because a measuring
instrument is not a shipped file.

**1. The website is 3 526 px tall, and the product inside it is 115 px.**

| region | height | share of the page |
| --- | --- | --- |
| `product` | 1 844 px | 52 % |
| `extension` | 718 px | 20 % |
| `footer` | 334 px | 9 % |
| `reasons` | 234 px | 7 % |
| `steps` | 189 px | 5 % |

**And inside `product`'s 1 844 px, the inbox is 115 px** — one row, because one message. **The mail is
3 % of the page.** The two explanation regions alone are **1 475 px, or 44 % of the document**, and
they sit below the product, so a visitor meets the explanation only after scrolling past a mailbox.

**2. Nine `h2`s share one size, so nothing on the page is subordinate to anything else.**

The whole document uses **four** type steps: **40 / 22 / 18 / 16**. Nine `h2`s are at **22 px,
weight 500** — `Ready`, `Your address`, `How long this address lasts`, `What this browser remembers`,
`Addresses this browser remembers`, `What this session did`, `What happens, in order`,
`Why SpectreMail`, `The extension, in this browser`. **`Why SpectreMail` and `Your address` are
typographically identical**, which means the page makes no claim about which of them it is for.

**And the hierarchy is inverted at the product's own centre.** `How long this address lasts` — a note
about a retention period the provider does not publish — renders at **22 px**. `Inbox` — the mail —
renders at **18 px** as an `h3`. **The note about the product is larger than the product.**

**`--type-2xl` is `1.75rem`, and no stylesheet in this repository reads it.** Measured across
`apps/web/src`, `apps/extension/src` and `packages/ui/src`: its only occurrence is its own declaration
in the generated `tokens.css`. `DESIGN.md` already admits this — *"`type-2xl` is declared and unused
today"* — so the step that would separate a heading from a datum has been available for the whole life
of the layer and spent on nothing.

**3. The address is styled as a label, and the accent is spent on replacing it.**

`.address__value` is **447 × 51 at 22 px**, which is **the same size and weight as every section
heading**, because `DESIGN.md` defines *Headline* as *"a region's name … a label on a working area
rather than a claim"* and then places the address on that same step. **The one value the person came
for is set as a label on a region.**

The only accent-filled control on the page is **`Replace address`** — `className="control
control--primary"` — and `Copy address` is a plain bordered `.control`. The reasoning is recorded in
`App.tsx`: *"the only control that moves a visitor forward is the one that replaces the address."*
**Measured against what the page is for, that identifies the recovery action as the primary one.** A
person who arrives here wants an address to put into somebody else's form; copying it completes that
job and replacing it abandons it.

**4. The inbox row is capped narrower than its own list, so a timestamp takes a third of it.**

`li { max-width: 62ch }` — `--measure-prose` — resolves to **534.75 px** inside a **688 px** list.
The row's grid is **already** `1fr auto`, exactly as `DESIGN.md` declares, and read from source rather
than from the resolved computed value: `320px 168.75px` was what `getComputedStyle` reported for
`1fr auto` on this row, not what the stylesheet says. **The `auto` column resolves to 169 px because
its content is `2026-10-18T18:08:41.000Z` verbatim at Mono size with `nowrap`** — **32 % of the row
spent on an instant**. A third row exists only because `.inbox-row__verdict` is pinned to
`grid-row: 3`.

**And the collision is inside the record, not only inside the stylesheet.** `DESIGN.md`'s Layout
paragraph says *"paragraphs and list items cap at 62 characters"* **and**, three sentences later,
*"the inbox row is its own two-column grid — the content in `1fr`, the timestamp in `auto` — so that
a time never wraps onto a second line"*. Both sentences are true of the shipped page and they
contradict each other: a mail row is a `li`, so the prose measure claims it, and a row of fields is
not a line of prose. **The repair is a qualification of the record and the one rule that follows it.**

**The ISO instant is not the defect and this change keeps it.** `InboxRow.tsx` records the decision
with its reason — *"unambiguous whatever the reader's locale and time zone … which is what lets a test
assert a row's contents without pinning a locale"* — and M7 re-affirmed it. **What failed is the
rendering of a correct decision:** the string was told to read as *"monospace at the smallest size,
right-aligned … metadata rather than prose"*, and it does, at a width it was never meant to occupy.

**5. Mobile breaks the address in the middle of its domain.**

At 390 px the address renders as `randomuser123456@sharklasers.c` / `om`, from
`overflow-wrap: anywhere` on an `inline-block` that shrinks to its content and only then breaks.

**6. The extension opens a message and shows no message.**

`OpenedMessageView` renders `Codes`, optionally `Links`, and `Close`. Measured on the built popup with
a real created mailbox and a message opened, the entire surface is:

```text
MESSAGES
One-time codes in this message      ← 18 px, weight 700, the largest text on the surface
• 493028    [Fill in code 493028]   [Copy code 493028]   ← panel only
No verification link was found in this message.
[Close]
```

**There is no sender, no subject, no arrival time and no readable text** — on either surface. **And the
data is already in the object the component receives**: `OpenedMessage extends MessageSummary` and
adds `readable`, `codes` and `links`, so `from`, `subject`, `receivedAt` and `readable` are four
fields of one value the component is handed — and it reads two of them (`codes`, `links`) while
rendering none of the other four. **The surface discards four fields it was given.** `apps/web`'s
`MessageView` renders the sender, the subject, the arrival time and the readable text; the extension
renders none of them.

**7. The extension's mail list is an unbrowser bulleted list.**

`MessageList` renders a bare `<li>` per message. Measured: `display: list-item`,
`list-style-type: disc`, **row width 65 px** in a 352 px container, height 60 px — so the verdict
sentence and the `Read` button stack inside a 65 px column under a **user-agent disc bullet**. A mail
list that draws a bullet is the most obviously unfinished object in the product, and it is the first
thing a person sees in the popup.

**8. The popup puts the report first, and the panel puts it last.**

The popup's sections, in order, measured: **`popup-diagnostic-heading` 234 px** → `address-heading`
122 px → `status-heading` 119 px → `inbox-heading` 219 px. **The report of what the session did is the
first thing in the popup and a fifth of the document**, and it carries a three-clause privacy
paragraph — *"It is counted in the popup while the popup is open, it is not kept anywhere, and nothing
about it is sent anywhere"* — above the address. The panel renders **the same component last**, and
`Panel.tsx` records why: *"it is the only section here that is about the session rather than about the
device or the page."* **The same component is at opposite ends of two surfaces, and one of the two
placements contradicts the reason written for it.**

And in the popup the address is **16 px in `rgb(74, 74, 82)`** — the smallest, dimmest object on a
352 px surface, while `.popup__heading` (the brand) is **22 px, weight 600**. **The brand outranks the
address in the product's own popup.**

**9. The panel's destructive control sits above its content, under a label that promises a list.**

Panel sections in order: host **68** → address **71** → **`panel-removal-heading` 86** → inbox
**156** → message **318** → diagnostic **234**. The removal section renders one 300 px control,
`Remove everything SpectreMail keeps here`, and **nothing else** — its heading is *"What this device
keeps"* and it lists nothing kept. **The destructive control is the third block on the surface and the
mail is the fourth.**

**10. The extension heads its address with a provider identifier, and the case transformation above it
was hiding that.**

`Popup.tsx` renders `<h2 id="address-heading">{mailbox.provider}</h2>`, and `Panel.tsx` renders
`PANEL_COPY.addressHeading(record.provider)`. **Both are handed an identifier.** Measured on the built
surfaces, the heading reads `mailtm`. `panel-copy.ts` documents that entry as *"it names the provider
rather than this surface's own name"*, and **its own test cannot see the difference**, because the
fixture supplies `["Mail.tm", "Guerrilla Mail"]` — exactly the shape production does not.
`MailProvider.displayName` exists and both adapters set it, and `primaryProviderName` already reads it
for the create heading, so **the client holds the name and renders the id**.

**The `h2` carried `text-transform: uppercase`, which is why nobody read it as a slug.** That
treatment is the quiet label step this change promotes into the record, so dropping it and repairing
the heading are one decision rather than two — **the case transformation was load-bearing for a copy
defect, which is the one thing a treatment must never be.**

**And the case transformation is measured to rename regions for assistive technology.** A temporary
spec added the label step to the built website one heading at a time and read Chromium's own tree:
with the rule present, `Accessibility.getFullAXTree` returned `READY` where it had returned `Ready`,
every `h2` and every region named by one was upper-cased, and `textContent` was unchanged while
`innerText` was not. **The label step is therefore size, weight, leading, tracking and colour**, and
the requirement states that a stylesheet SHALL NOT rename a region.

### The finding underneath all nine

**The two clients disagree in opposite directions on the same token layer, and each already contains
the answer the other lacks.**

| | website | extension |
| --- | --- | --- |
| the address | **22 px** — the size of a section heading | **16 px**, `ink-secondary` — the dimmest object |
| section labels | nine `h2` at 22 px, no quieter step | **12 px** uppercase, `ink-muted`, `--tracking-wide` |
| the mail's own fields | sender, subject, time, readable text | **none of the four** |

**The extension's quiet label treatment is the one that works and the website has none of it. The
website's address prominence is the one that works and the extension has none of it.** The token layer
already declares every value either fix needs — `--type-xs`, `--ink-muted`, `--tracking-wide`,
`--type-2xl` — so **this change is predicted to declare no new token**, and a new token would mean the
diagnosis was wrong about where the defect lives.

## Why this is a change and not a task

**Because three of its causes are written down in a design record and a promoted requirement, not in a
stylesheet.** A restyle would move the same nine headings to a different size and leave the record
claiming the address is a *Headline* — a label on a region — which is the sentence that produced the
defect. **The record is the thing to correct; the CSS follows it.**

**And one requirement has to be amended rather than worked around.** `visual-system` says the accent
reaches *"a primary action"* and its scenario names *"the page offers its forward control"*, and its
Note fixes the subject as `Replace address`. **Moving the accent to `Copy address` contradicts the
Note**, so it is a `MODIFIED` block with the contrary reasoning carried forward, not a quiet
restyle that leaves the specification saying something the page no longer does.

**And the extension's message view is a requirement gap rather than a CSS defect.** No
`extension-client` requirement names the message's own fields; the closest says a user who opens a
message SHALL see *"the one-time codes detected in that message"*, and the build satisfies it exactly.
**A surface that satisfies its requirement while showing nobody the message is the requirement's
fault**, and the repair is a requirement plus the composition it describes.

## What ships

1. **A design decision, stated once and applied to both clients: labels are labels, and data is
   loud.** Region and state names take the quiet label step the extension already uses — `--type-xs`,
   `--ink-muted`, `--tracking-wide` — and the product's data takes the large steps: the
   address at `--type-2xl`, a message's sender and subject above body size, a detected code at
   `--type-xl`. **`DESIGN.md`'s Hierarchy section is amended to say so**, and its claim that the
   address is a *Headline* is deleted rather than reworded, because that sentence is the defect.
   **The step carries no case transformation**, for the reason item 10 measures.
2. **The website's `product` region recomposed**: the state heading demoted to a label, the seven
   inner regions labelled rather than shouted, the address enlarged and unboxed, the accent moved to
   `Copy address`, and the inbox row given a grid that spans its list.
3. **The extension's three surfaces recomposed**: the popup's report moved below the address, its
   address raised to the product's own step, the mail list turned into a real row grid with no
   bullet, the panel's removal section moved below the inbox, and the address heading naming the
   provider the way the provider names itself.
4. **The extension's opened message shows the message**: sender, subject, arrival time and readable
   text, above the codes, on both the popup and the panel — pinned by a new requirement.
5. **Eight requirement blocks across three capabilities**: `visual-system` gains the label role as an
   `ADDED` requirement and has its accent requirement `MODIFIED`; `website-client` has the address and
   the inbox `MODIFIED`; `extension-client` gains four `ADDED` requirements — the opened message, the
   message row, the surface order, and the provider's own name. **No block is `REMOVED`, no capability
   is added, and `page-composition` is untouched.**

**Every region name, every control name and every state-to-region mapping is unchanged.**
`page-composition` freezes all three on purpose, and this change works within that freeze rather than
amending it: it moves type sizes, spacing, grids and one control's treatment, and it relocates no
state. **The ~20 assertions that read a region by its accessible name are expected to pass unchanged,
and a movement in any of them is evidence this change did something it did not declare.**

## What this does not establish

- **Nothing about how any of it looks.** No test in this repository reads a rendered pixel's colour or
  position. The measurements above are boxes, computed styles and DOM order; whether the result reads
  as right is a human judgement, and the screenshots that produced the diagnosis are not a gate.
- **Nothing about the website's four non-product regions.** `steps`, `reasons`, `extension` and
  `footer` are untouched. Their share of the page is recorded above and is **not** addressed here.
- **Nothing about whether the address should be bigger.** That the address outranks a section label is
  a decision argued from what the page is for; it is not a measurement, and the measurement only
  establishes that today they are the same size.
- **Nothing about a real provider, a real clipboard, or a popup a person clicked.** The extension's
  surfaces were driven at their own viewport sizes as tabs, which is the substitute
  `in-page-fill`'s `design.md` D10 already records.
- **Nothing about the in-page control.** It is a fourth surface and it renders in a shadow root with
  its own hardcoded stylesheet; **this change leaves it alone**, and its own disagreement with the
  token layer is recorded below as a finding rather than repaired here.

## Recorded rather than repaired

Each of these was found by this diagnosis and is outside this change's scope. They are written down so
a later change does not have to rediscover them.

1. **The website's footer is the one `h2` on the page set at a size no other `h2` uses.** Its heading,
   `What this page can and cannot do`, is `--type-lg` (18 px) while the page's other ten `h2` are
   `--type-xl` (22 px) — and `--type-lg` is the record's *Title* step, which `DESIGN.md` assigns to
   *"a named step, or a message's subject line"*. So the footer states its subject at the size the
   record reserves for a step inside a surface, and it is also the only `h2` on the page whose
   children are `--type-sm`. **The outline is sound** — the footer is a sibling landmark with its own
   `h2`, and it is the heading's *size* that is outside the scale's own pattern, not its level.
2. **The in-page control's accent is `#7c6cf0`, spelled twice as a literal**, inside a shadow-root
   stylesheet that cannot read the token layer's custom properties. Its comment claims *"the same
   violet the token layer declares"* — a coupling stated in prose and held by nothing.
3. **The panel's chooser repeats a full address to label a choice about that address.** Its label is
   `Show ${address} in this panel` — **the address rendered again, at `--type-xs` in monospace inside
   a `width: 100%` button**, when the address the choice is about is already on the surface above it at
   `--type-base`. With `overflow-wrap: anywhere`, a 32-character local part plus `@` plus domain wraps
   to three lines inside a 352 px panel, and the control's own verb is the only part it does not
   repeat. **A control that restates its subject rather than naming its action** is a copy question,
   and this change does not rewrite copy.
4. **`specs/provider-terms-review`'s cadence copy and the popup's diagnostic paragraph are copy, not
   composition**, and this change moves them without rewriting them.
