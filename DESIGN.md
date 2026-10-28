---
name: SpectreMail
description: Temporary email that meets the flow instead of interrupting it.
colors:
  surface-page: "#f4f4f2"
  surface-page-dark: "#0e0e11"
  surface-raised: "#ffffff"
  surface-raised-dark: "#17171b"
  surface-sunken: "#e9e9e6"
  surface-sunken-dark: "#08080a"
  surface-accent: "#efecfb"
  surface-accent-dark: "#1e1a2e"
  surface-danger: "#fbeeee"
  surface-danger-dark: "#2a1618"
  ink-primary: "#16161a"
  ink-primary-dark: "#ecedf0"
  ink-secondary: "#4a4a52"
  ink-secondary-dark: "#b0b0b8"
  ink-muted: "#5e5e68"
  ink-muted-dark: "#96969f"
  ink-accent: "#4a2fb8"
  ink-accent-dark: "#b8a4f7"
  ink-danger: "#a4262c"
  ink-danger-dark: "#f0928f"
  ink-on-accent: "#ffffff"
  ink-on-accent-dark: "#0e0e11"
  line-subtle: "#dcdcd8"
  line-subtle-dark: "#2b2b32"
  line-strong: "#6f6f78"
  line-strong-dark: "#7a7a87"
  accent: "#5a3fd0"
  accent-dark: "#a48cf5"
  focus: "#5a3fd0"
  focus-dark: "#a48cf5"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.15
  subtitle:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    lineHeight: 1.65
  code:
    fontFamily: "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Menlo, Consolas, monospace"
    fontSize: "1.125rem"
    letterSpacing: "0.08em"
rounded:
  radius-sm: "2px"
  radius-md: "4px"
  radius-lg: "6px"
  radius-pill: "999px"
spacing:
  space-0: "0"
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.5rem"
  space-6: "2rem"
  space-7: "3rem"
  space-8: "4rem"
  space-9: "6rem"
---

# Design System: SpectreMail

## Overview

**Creative North Star: "The Instrument Panel"**

A working surface, not a poster. The instrument panel is the whole thesis: a screen you
read to find out what is true and touch to make something happen. Every element on these
surfaces is either a readout or a control. An address is a readout. An inbox row is a
readout that is also a control. A detected code is a readout with exactly one action
attached. Nothing is present to persuade: no illustration, no icon set, no logo wall, no
metric that flatters, no diagram of a process the product does not have. A person arrives
mid-task — halfway through somebody else's signup form — and leaves as soon as the code is
copied, and the interface's job is to be legible for precisely that long.

Structurally this is a Swiss layout put to work rather than exhibited: one column on a
declared measure, a 4-point rhythm, hairline rules where a card would go, and a type scale
whose steps are far enough apart to read as hierarchy rather than as accident. The system
is quiet at rest and precise under the pointer. The only motion is an entrance. The only
depth is a step in tone. The only colour is a violet, and it appears only where a person is
meant to act or where a value is meant to be believed.

Three exclusions are confirmed rather than implied. **There is no depth**: not one shadow,
gradient or backdrop blur exists in either client's stylesheet. **There is no borrowed
surface**: no webfont, no icon font, no image file, no third-party stylesheet — the brand
mark is inline SVG and the depiction of the popup is drawn in markup, because a picture of
the extension must not become an asset the extension never loads. And **there is no card
grid**: blocks are separated by a hairline and space, and a bordered box appears only where
the thing inside it is a reading surface.

**Key Characteristics:**

- One accent, five jobs, and no sixth.
- Two colour schemes, both declared literally, both held to the same thresholds.
- System type stacks only; the monospace is reserved for values.
- Hairlines and tonal steps instead of shadows and soft radii.
- Entrance-only motion, removed entirely — not shortened — under reduced motion.
- A 46rem working column, prose measured at 62 characters.

## Colors

A near-neutral system with one chromatic actor: warm paper and carbon ink carry the page,
and a single violet does the pointing.

### Primary

- **Spectral Violet** (`accent`, `ink-accent`, `surface-accent`, `focus`): the only hue on
  the page, declared in four tokens because one colour used as a fill, as text and as a
  tint has three separate contrast relationships to satisfy, and the ring is a fourth job
  rather than a brightness of the same one. As `accent` it is the fill of
  the one forward action and the rule that marks a row carrying a verification. As
  `ink-accent` it is the tinted surface behind a code and the host of a verification link.
  As `focus` it is the ring every control draws, so that the indicator a keyboard user
  follows is the same colour the page uses to mean _this matters_.

The accent has five jobs and the list is closed. **Identity**: the brand mark, the one place
it is not text. **Verification**: a code, a link's host, a row's marking rule and its
verdict word. **State**: the selected and active surface. **Forward motion**: the primary
fill. **Depiction**: the labels inside the drawing of the popup, tinted so that the drawing
reads as a drawing rather than as a row of controls. Anything outside that list wants
`--ink-primary` instead.

### Neutral

- **Warm Paper** (`surface-page`): the page background. Warm against pure white, so the
  raised surfaces still read as raised.
- **Carbon Ink** (`ink-primary`): body copy. A near-black with a trace of blue rather than
  a brown-black — a warm background under a warm ink produces a cast that reads as dirt on
  the text at small sizes, and the cast is exactly what a Swiss layout is trying not to
  have.
- **Two greys between them** (`ink-secondary`, `ink-muted`): supporting copy, and technical
  metadata. Neither is ever used for something a person must read at body size and act on.
- **Raised and sunken** (`surface-raised`, `surface-sunken`): the two tonal steps that do
  the work a shadow would do elsewhere. Raised is a control or a row; sunken is a reading
  surface set below its surroundings, and the fill a control empties into under the pointer.
- **Hairlines** (`line-subtle`, `line-strong`): `line-subtle` separates and is held to no
  threshold, because nothing depends on perceiving it. `line-strong` **identifies** — a
  control's edge, a step's division — and is held to non-text contrast in both schemes.
- **Sealing Wax** (`ink-danger`, `surface-danger`): failure. A deep oxblood for the words
  and a barely-tinted wash for the region around them. Failure is never signalled by
  colour alone: the sentence says what happened.

### Named Rules

**The One Accent Rule.** There is one hue in the palette and there will not be a second.
A system that reaches for a tertiary colour is a system asking a colour to carry meaning it
has not written down.

**The Ink Moves With The Fill Rule.** Any state that repaints a control's surface repaints
its label in the same rule. A label left on a fill it was never measured against is not a
dim label — it is an absent one, and this system shipped that defect once on its own
primary action.

**The Declared Second Scheme Rule.** The dark scheme is declared, not derived. It is a
literal set of values, not an inversion, a filter, or a computed transform, and every pair
is held to the same threshold in both. A derived palette is a palette nobody chose.

**The Words Carry It Rule.** Colour never carries a distinction on its own. A row that
carries a code is marked by a rule _and_ by its verdict word; a failure is tinted _and_
written; a code is violet _and_ set in monospace at a size of its own.

## Typography

**Display Font:** the system grotesk stack (`--font-sans`) — `system-ui`, then Segoe UI,
Roboto, Helvetica Neue, Arial, sans-serif.

**Body Font:** the same stack. There is one grotesk, not a display face and a text face.

**Label/Mono Font:** the system monospace stack (`--font-mono`) — `ui-monospace`, Cascadia
Mono, Segoe UI Mono, Menlo, Consolas, monospace.

**Character:** one grotesk and one monospace, both resident on the machine that renders
them. The grotesk carries language; the monospace carries values. Nothing is downloaded, so
the product cannot change its own letterforms and no visitor's address is spent on a font
request — in the one product whose stated subject is what is kept on this device, a fetched
font would be a contradiction with a nice typeface.

### Hierarchy

- **Display** (600, 2.5rem, 1.15, tight tracking): the product's name, once, at the top of
  the page. Nothing else is set at this size.
- **Headline** (500, 1.375rem, 1.15, tight tracking): a region's name — _Inbox_,
  _Message_. Medium rather than bold, because a region heading is a label on a working area
  rather than a claim.
- **Title** (500, 1.125rem, 1.15): a named step, or a message's subject line.
- **Subtitle** (600, 1rem, 1.5): the heading of a finding inside a message — _One-time
  codes found_. Body size at bold weight, so a sub-section of a reading surface stays
  inside that surface's scale.
- **Body** (400, 1rem, 1.65): everything a person reads. Measured to 62 characters, because
  a line that runs the full column loses the eye's return sweep and the page starts to read
  as a document.
- **Label** (500, 0.875rem, 1.5): a control's word. Medium, never bold — a button that
  out-shouts the mailbox is a button competing with the subject.
- **Mono** (400, 0.875rem, 1.65): a message body as the provider sent it, a verification
  link, an arrival time.
- **Code** (400, 1.125rem, mono, wide tracking): a detected one-time code. Wide tracking
  separates the glyphs of a value a person reads once and retypes by hand.

Two elements cross roles deliberately, and both are readouts. The **address** is set in
monospace at the headline step, and a **code** is monospace at the title step, because a
readout is set in the family that says _this is a value_ at the size its position on the
page has earned. Everything else sits at the step named above.

The scale declares seven sizes. `type-2xl` is declared and unused today, and is recorded
here rather than left for someone to discover and assume a home.

### Named Rules

**The No Downloaded Letterform Rule.** System stacks only. A `@font-face` is an outbound
request, and this product makes none to render itself.

**The Mono Means Data Rule.** Monospace marks a value the person may need to copy, compare
or retype: an address, a code, a link, a timestamp, or a body the provider wrote. It is
never used for emphasis, and it is never used for a sentence the product wrote about
itself.

**The Three Weights Rule.** 400, 500, 600, and nothing else — no 700, no 300, no italic
anywhere in either client. 400 is what a person reads, 500 is a control or a supporting
label, and 600 is a heading or the word a small block is about. Emphasis at a fourth weight
is emphasis the scale did not need.

## Layout

One column. The page is a working column of 46rem, centred, with page padding from the
space scale above and below. That measure is a decision and not a default: a marketing hero
wants a width a headline can fill, and this page wants the width the mailbox needs.

Inside the column, the page is a stack of regions separated by space and, where a
separation has to be visible, by one hairline. Prose inside a region is additionally
measured — paragraphs and list items cap at 62 characters even though the column is
wider — so that a reading surface and a control surface can share a column without the
prose becoming a wall.

The rhythm is a 4-point scale, and it is closed. Spacing steps are `space-0` through
`space-9`; there is no arbitrary gap anywhere in either stylesheet. A region opens with a
hairline and `space-6` of air on both sides of it. The page's own padding is `space-7` at
the top and `space-8` at the bottom, and the lead line under the wordmark is `space-7`
below. Grouping inside a region is `space-1` and `space-2`; a control's internal padding is
`space-2` by `space-4`; a reading container's is `space-4` all round.

Two grids exist, both written in the client's stylesheet rather than in the token layer,
because layout is a client's business and a `--grid-columns` token would be the thing that
ended that clause: the three steps sit on `repeat(3, 1fr)` with `space-5` between them, and
the reasons pair sits on `repeat(2, 1fr)`. The inbox row is its own two-column grid — the
content in `1fr`, the timestamp in `auto` — so that a time never wraps onto a second line
and disagree with the row above it.

**There is one breakpoint, at 34rem, and only the website has it.** At or below it, both
multi-column grids collapse to a single column and nothing else changes: the type scale does
not shrink, the accent does not move, and no element is hidden. A second breakpoint would be
a second layout, and this page has one. The extension declares no breakpoint at all — a
popup is a fixed-width surface, and a responsive popup is a popup that will be resized by a
browser that does not own its width.

### Named Rules

**The Hairline Not Card Rule.** Separation is a rule and space. A bordered box is reserved
for a thing that is a reading surface — a message body, a finding, a notice, the depiction
of the popup — and never used to group a section. A page where every block is a card has no
hierarchy left to spend, because the border has become the loudest thing on it.

**The One Breakpoint Rule.** 34rem, and it collapses columns rather than changing the
design. Responsive does not mean a second system.

**The Working Measure Rule.** 46rem for the column, 62 characters for prose. Neither is
negotiable per region; a region that wants to be wider is a region that wants to be a
different product.

## Elevation & Depth

**Flat, and stated rather than implied.** There is no shadow in this system: not one
`box-shadow`, not one gradient, not one backdrop blur, in either client's stylesheet. Depth
is carried entirely by tone and by line.

Three surfaces make the whole vocabulary. `surface-page` is the ground. `surface-raised` is
a step towards the reader — a control at rest, an inbox row, a finding. `surface-sunken` is
a step away — the readable body of a message, the depiction of the popup, and the fill a
control empties into under the pointer. Two tints sit beside them for state and for failure,
and neither is a step in depth: they are colour on a surface that has not moved.

The effect a shadow would produce is produced instead by adjacency. A raised surface
against the page reads as raised because the page is a shade darker, and a hairline between
them confirms the edge. Nothing floats, nothing overlaps, and no element is ever drawn on
top of another — which is also why the system needs no z-index discipline.

### Named Rules

**The Tone Not Shadow Rule.** If a surface needs to separate, it gets a step in the surface
scale and a hairline. It does not get a shadow, a glow, or a blur. A shadow is a claim that
something is above something else, and nothing here is.

**The No Overlap Rule.** Elements do not sit on top of one another. There is no popover, no
tooltip, no floating action, and no overlay. A surface that would need one needs a different
layout instead.

## Shapes

The form language is a rectangle with a barely-rounded corner and a one-pixel edge.

The radius scale declares four steps — 2px, 4px, 6px, and a pill — and **uses the first
two**. 4px is the working radius on every control, box and code block; 2px appears on inbox
rows and the depiction's inner tiles. The 6px step and the pill are declared and unused, and
are recorded here so that a future surface does not mistake their absence for an oversight,
and so that a pill, if it is ever used, is a decision rather than a drift. Nothing in use is
rounder than 6px: a 12px corner on a 1px border reads as friendly, which is a different
product.

Every edge is 1px. Two pixels appears in two roles and both are semantic: the focus ring, on
both clients, and — on the website — the rule that marks an inbox row as carrying a
verification. A thicker border is never decoration.

The focus indicator is a 2px outline in the accent, offset 2px from the control it marks,
so it is drawn _outside_ the element rather than inside its edge where the border would
clip it. It is drawn on `:focus-visible`, which means a mouse press leaves no ring behind
and a keyboard press always does.

There is no clipping, no mask, no circle, and no diagonal. The brand mark is the only
non-rectangular shape on either surface, and it is a mark rather than a shape system.

### Named Rules

**The Small Radius Rule.** Nothing in use is rounder than 6px, and the working radius is
4px. Softness is not neutrality; a large radius is a tone of voice.

**The Semantic Thickness Rule.** 1px everywhere, 2px only for the focus ring and the
verification rule. A border that is thick because it looked better is a border carrying no
meaning.

## Components

The component philosophy is **precise and quiet**: a control is identified by its edge,
answers on hover by emptying its fill, and confirms a press by moving one pixel. Nothing
scales, nothing glows, nothing changes colour family.

### Buttons

- **Shape:** 4px radius, 1px `line-strong` edge, `space-2` by `space-4` padding, label at
  the label step in medium weight.
- **Quiet (default):** `surface-raised` fill, `ink-primary` label. The edge is what
  identifies it — a control with a transparent fill is identified by its boundary, which is
  why `line-strong` is held to non-text contrast and `line-subtle` is not.
- **Hover:** the fill empties to `surface-sunken`. The label does not move, because it is
  already `ink-primary` and that pair is declared.
- **Active:** the same repaint, plus a 1px downward translation. One pixel is enough to
  feel and small enough that a screenshot mid-click does not look broken.
- **Primary:** the one filled control on a surface — `accent` as both fill and border, with
  `ink-on-accent` as its label, a token that exists because no other ink in the palette
  reaches the body threshold against the accent in either scheme. Hover and active empty
  the fill _and_ return the label to `ink-primary`, keeping the accent as the border so the
  control is still the one that moves you forward at rest.
- **Disabled:** the boundary goes to `line-subtle` and the cursor to `not-allowed`. The
  label is never dimmed by `opacity`, because opacity dims it below the ratio it is held
  to; the affordance goes, the words stay readable.

### Cards / Containers

- **Corner Style:** 4px, or 2px where the container is a row.
- **Background:** `surface-raised` for a finding or a notice; `surface-sunken` for a body
  the provider wrote or a depiction; `surface-danger` for a failure region.
- **Shadow Strategy:** none. See _Elevation & Depth_.
- **Border:** 1px. `line-strong` where the edge carries meaning (a notice, a control, a
  step's division), `line-subtle` where it is a separator (a message body, a row).
- **Internal Padding:** `space-3` by `space-4` for a compact container, `space-4` all round
  for a reading one, `space-5` for a depiction.

### The Inbox Row

A row is a control that is also a readout, and it is the densest thing in the product. It
is a two-column grid — sender and subject in the content column, arrival time in a
fixed-width second column, the unread state and the verdict beneath — with `space-1` down
and `space-4` across. The sender is medium weight, the subject `ink-secondary`, the time
`ink-muted` in monospace at the smallest step, and the verdict `ink-accent` at the smallest
step in medium weight with wide tracking.

A row that carries a verification is marked by a 2px accent rule on its leading edge, never
by a tint. The words already say a code was found; the rule agrees with them.

### The Code Block

The signature component. A detected one-time code is set in monospace at the title step
with wide tracking, inside a `surface-accent` fill with an `accent` hairline and a 4px
radius, with the code itself in `ink-accent`. It is a filled block rather than coloured
text on purpose: a code is a value to read and retype, and a value that changes shape when
it is copied is a value that gets mistyped.

Every code carries its own control. There is no "top-ranked code" control, because the
parser never reports a detection as certain and a single control would be the interface
asserting a confidence the system does not have. Confidence is never rendered as a number.

### The Failure Region

A failure is a region with a `surface-danger` wash, `ink-danger` copy, and a `line-strong`
edge. It states what failed, in the provider's own normalized vocabulary, and it never
claims more than was observed: an address that could not be checked is _unconfirmed_, not
gone. A failure inside a region that is otherwise healthy is a _notice_ instead — a raised
box with a `line-strong` edge — because tinting a whole region for one sentence would say
the region had failed.

### The Depiction

The website shows what the extension's popup looks like, drawn in markup rather than
screenshotted. It is a `surface-sunken` plate with a `line-subtle` hairline, containing
plain text at the popup's own labels. **It contains no interactive element of any kind** —
not a button, not a link, not a disabled version of one — because a control inside a
picture of a control is a control that does nothing when pressed. It does not animate: a
depiction that draws the eye spends attention on the one thing on the page that cannot be
used.

## Do's and Don'ts

### Do:

- **Do** put the accent on a code, a verification link's host, a marked row's rule and its
  verdict word, the brand mark, the primary fill, and a depicted label — and nowhere else.
- **Do** repaint a control's label in the same rule that repaints its fill.
- **Do** separate with a hairline and a step in tone; reserve the bordered box for a
  reading surface.
- **Do** set a value the person may copy or retype in monospace: an address, a code, a
  link, a timestamp.
- **Do** state the uncertainty. _Unconfirmed_ is a legitimate state and _gone_ is a claim
  the product often cannot make.
- **Do** keep both schemes literal and hold both to the same contrast thresholds.
- **Do** remove motion entirely under `prefers-reduced-motion: reduce`, with
  `animation: none` rather than a near-zero duration.
- **Do** draw the focus ring outside the element it marks, in the accent, on
  `:focus-visible`.
- **Do** let a region be a region: space and a rule, not a container.

### Don't:

- **Don't** add a second hue, a gradient, a mesh, or a glow. The palette has one actor.
- **Don't** use a shadow to imply depth. Depth is a tone; nothing here floats.
- **Don't** put every block in a card, and don't nest a card in a card.
- **Don't** use `opacity` to disable a control — dim the affordance, keep the words.
- **Don't** set a sentence the product wrote about itself in monospace, and don't use
  monospace for emphasis.
- **Don't** round a corner past 6px. Softness is a tone of voice, and this one is precise.
- **Don't** dim a label below the ratio it is held to in any state, including hover,
  active, pressed and disabled. Read the pair, then repaint the label with the surface.
- **Don't** render confidence as a number, a percentage, a meter, or a count of stars.
- **Don't** draw a control inside a depiction of a control, and don't animate a depiction.
- **Don't** fetch a font, an icon set, an image, or a stylesheet. Every mark on these
  surfaces is drawn from a value already in the repository.
- **Don't** invent a breakpoint, a radius, a spacing step or a type size outside the scale.
  There is one scale, and a value outside it is a value nobody chose; a declared step that is
  unused stays unused until somebody decides otherwise, and the decision is written down.
