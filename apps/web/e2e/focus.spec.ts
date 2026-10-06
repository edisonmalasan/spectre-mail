/**
 * The focus indicator the page actually draws.
 *
 * ## Why this is in the browser tier and not in the unit tier
 *
 * Because it is the one claim about this milestone that no other instrument can make.
 * `getComputedStyle` in **jsdom resolves no outline at all** — jsdom implements the CSS
 * cascade for a documented subset of properties, and `outline-style`, `outline-width`,
 * and `outline-color` are not in it, so a jsdom reading is `""`. An assertion written
 * against that would either pass for the wrong reason or fail for a reason that has
 * nothing to do with the page. The honest instrument is a browser that resolves cascade
 * and paints, and this repository already has one tier deliberately not running `vitest`.
 *
 * So the two appearance claims M7 slice 1 makes are held by two different instruments, on
 * purpose:
 *
 * - **contrast** is pure WCAG arithmetic over two hex values, so it is a unit test in
 *   `packages/ui` — the strongest instrument available, and the one that lets a ratio be
 *   asserted to two decimal places rather than merely "it looks legible";
 * - **focus** is a rendering outcome, so it is this file.
 *
 * ## What this file deliberately does NOT check
 *
 * **It checks that an indicator exists, not that SpectreMail looks good.** Nothing in this
 * repository reads a rendered pixel's colour, and this file does not start now. It answers
 * "can a keyboard user see where they are", which has a right answer. "Does this respect
 * the approved direction" has none, and is owed a person looking at the page.
 *
 * **It reaches every control with the keyboard, deliberately.** `:focus-visible` — which
 * the stylesheet targets, so a mouse click does not leave a ring behind — is a heuristic
 * in every browser, and a programmatic `.focus()` is **not** guaranteed to satisfy it. A
 * spec that called `element.focus()` and then asserted a ring would be asserting a
 * property of its own assertion. Every control below is reached by pressing Tab, which is
 * what a keyboard user does and what the heuristic is defined against.
 *
 * ## Why the negative control is the most important assertion in the file
 *
 * Every other assertion here is of the form "no control is missing an indicator", and an
 * assertion of that form is satisfied by a reader that never fails. The last test in this
 * file therefore plants the exact thing the milestone forbids — `outline: none` — into the
 * running page and requires the **same readers** to report it. Without it, a helper
 * returning `""` for everything would pass all four positive tests.
 *
 * ## Why nothing here is passed into `page.evaluate` by closure
 *
 * `page.evaluate` serialises the function and runs it in the page, where the module's
 * scope does not exist. A reader written as a named function that referenced
 * `FOCUSABLE_SELECTOR` would resolve it as an undefined global at run time — the kind of
 * failure that reads as a page that has no controls. So every callback below takes its
 * selector as an argument and defines its own logic inline, at the cost of repeating four
 * lines of `getComputedStyle` reading. That repetition is the cheaper mistake.
 *
 * @module
 */

import { expect, test, type Page } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";

/**
 * The outline a control is currently resolved to have, as a browser resolves it.
 *
 * **The four properties are recorded separately rather than as one string**, because they
 * fail independently and a concatenated value hides which. The failure this file exists to
 * catch — an author writing `outline: 2px solid transparent` — has a width *and* a style
 * and is caught only by the colour, so a single "is there an outline" test would pass on
 * exactly the defect that matters most.
 */
interface OutlineReading {
  /** A name for the failure message, so a reader knows which control to open. */
  readonly name: string;
  readonly style: string;
  readonly width: string;
  /** `rgb(...)` or `rgba(...)`, as the browser reports it. */
  readonly color: string;
  readonly offset: string;
}

/** One control's before-and-after readings. */
interface ControlFocus {
  readonly name: string;
  /** The same control, resolved while something else held focus. */
  readonly unfocused: OutlineReading;
  /** The same control, resolved while the keyboard was on it. */
  readonly focused: OutlineReading;
}

/**
 * A keyboard-reachable control, named, with the index that actually reaches it.
 *
 * **The index and the name come from one read on purpose** — see `focusableControls`.
 */
interface ControlRef {
  /** The element's position in `document.querySelectorAll(FOCUSABLE_SELECTOR)`. */
  readonly index: number;
  readonly name: string;
}

/**
 * A traversal's readings, plus what changed in the page while it ran.
 *
 * **`drift` is `[]` in every healthy run and is the reason this is not a bare array.** A
 * traversal that reports readings while the control set is moving is reporting readings
 * about whichever elements happened to occupy those indices, and the only visible symptom
 * is a name that was expected and is not — which is the failure CI produced, and which this
 * repository's own history says to diagnose rather than to widen the assertion around.
 */
interface Traversal {
  readonly readings: readonly ControlFocus[];
  readonly drift: readonly string[];
}

/**
 * What changed between two reads of the control set, as sentences.
 *
 * **Reporting the difference rather than a boolean**, because "the control list changed" is
 * not a cause and "row 1 was 'Open A', now 'Open B'" is. Empty means the two reads agreed.
 */
function describeDrift(before: readonly ControlRef[], after: readonly ControlRef[]): string[] {
  const drift: string[] = [];

  const longer = Math.max(before.length, after.length);

  for (let position = 0; position < longer; position += 1) {
    const was = before[position];
    const now = after[position];

    if (was === undefined && now !== undefined) {
      drift.push(`position ${position} appeared: "${now.name}"`);
    } else if (was !== undefined && now === undefined) {
      drift.push(`position ${position} disappeared: was "${was.name}"`);
    } else if (
      was !== undefined &&
      now !== undefined &&
      (was.index !== now.index || was.name !== now.name)
    ) {
      drift.push(
        `position ${position} was "${was.name}" (index ${was.index}), now "${now.name}" (index ${now.index})`,
      );
    }
  }

  return drift;
}

/**
 * The selector for "a control the keyboard can reach".
 *
 * **Written here rather than imported, because there is no shared definition of it and
 * inventing one would be a second spelling.** It mirrors what a browser considers
 * focusable, plus the two exclusions that matter: a disabled button cannot be reached, and
 * an element that took itself out of the tab order has declined to be reached.
 */
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Every keyboard-reachable control, in DOM order, **with the index that reaches it**.
 *
 * ## Why this returns indices rather than names
 *
 * Because the first version returned names and the readers indexed by position, and the
 * two disagreed. `focusableNames()` filtered with `getClientRects()` while `outlineAt()`
 * and `focusIsAt()` indexed `document.querySelectorAll(selector)` **unfiltered** — so any
 * element matching the selector with no layout box shifted every later reading by one, and
 * the tail of the list fell off the end.
 *
 * **This was not a theoretical mismatch; it is what CI observed on the browser tier's
 * first ever run** (run `37439940701`, `browser` job). The spec reported
 * `expect(names.some((name) => name.includes("Clear saved data"))).toBe(true)` failing with
 * `received: false`, while `names.length > 0` and `names.some(… "Copy address")` both
 * passed. That signature is the shift: the head of the list is correct and the tail is
 * truncated. It did not reproduce on the machine that wrote it, across repeated runs at
 * two workers, and the difference in that failure's shape is exactly what a one-position
 * shift produces and what a missing button does not.
 *
 * **So there is now one place that decides which elements count**, and it hands out the
 * index that reaches the element it counted. A second spelling of "the focusable set" is
 * the thing that failed, and removing it is the fix rather than adding a guard to both
 * copies.
 *
 * ## Why visibility is measured with `getClientRects()`
 *
 * `offsetParent` is `null` for a `position: fixed` element, which is a visible element, so
 * a page that later positions a sticky control would silently drop it from this list and
 * the assertions below would shrink rather than fail.
 */
async function focusableControls(page: Page): Promise<ControlRef[]> {
  return page.evaluate((selector) => {
    const refs: { index: number; name: string }[] = [];

    Array.from(document.querySelectorAll(selector)).forEach((element, index) => {
      if (element.getClientRects().length === 0) return;

      const label = element.getAttribute("aria-label");
      const source = label !== null && label !== "" ? label : (element.textContent ?? "");
      refs.push({ index, name: source.replace(/\s+/g, " ").trim() });
    });

    return refs;
  }, FOCUSABLE_SELECTOR);
}

/** Page-side: the resolved outline of one element. Duplicated per callback on purpose. */
async function outlineAt(page: Page, index: number): Promise<OutlineReading> {
  return page.evaluate(
    ({ selector, index }) => {
      const element = Array.from(document.querySelectorAll(selector))[index];
      if (element === undefined) throw new Error(`no keyboard-reachable control at index ${index}`);

      const style = getComputedStyle(element);
      const label = element.getAttribute("aria-label");
      const source = label !== null && label !== "" ? label : (element.textContent ?? "");

      return {
        name: source.replace(/\s+/g, " ").trim(),
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
        offset: style.outlineOffset,
      };
    },
    { selector: FOCUSABLE_SELECTOR, index },
  );
}

/** Page-side: the resolved outline of whatever currently holds focus. */
async function outlineOfFocused(page: Page): Promise<OutlineReading> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) throw new Error("nothing holds focus");

    const style = getComputedStyle(element);
    const label = element.getAttribute("aria-label");
    const source = label !== null && label !== "" ? label : (element.textContent ?? "");

    return {
      name: source.replace(/\s+/g, " ").trim(),
      style: style.outlineStyle,
      width: style.outlineWidth,
      color: style.outlineColor,
      offset: style.outlineOffset,
    };
  });
}

/** Page-side: is the `index`-th keyboard-reachable control the one holding focus? */
async function focusIsAt(page: Page, index: number): Promise<boolean> {
  return page.evaluate(
    ({ selector, index }) =>
      Array.from(document.querySelectorAll(selector))[index] === document.activeElement,
    { selector: FOCUSABLE_SELECTOR, index },
  );
}

/** Page-side: give up focus entirely, so "unfocused" means unfocused. */
async function blurEverything(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

/** How long to wait between reads while the page settles. */
const SETTLE_POLL_MS = 100;

/**
 * How many reads must agree, in a row, before the page counts as settled.
 *
 * **Five, which is a 400ms window, and the number comes from the failure rather than from
 * taste.** The row that CI caught appeared *during* a walk lasting seconds, so "two agreeing
 * reads" would not have caught it — and the first version of this wait did exactly that and
 * failed its own positive control, which plants a control that gains a box 150ms in. **A
 * precondition of two agreeing reads 100ms apart is not a precondition**; it is a coin toss
 * with a delay.
 *
 * **The honest limit, which is why the drift assertion was not weakened to compensate.** No
 * duration makes this certain: on a slower runner the row could appear after the window. What
 * the wait buys is that the common case is covered, and what *guarantees* the reading is the
 * post-walk drift check, which still fails the spec if the set moved while it was being read.
 */
const SETTLE_STABLE_READS = 5;

/** How many reads to allow before calling a page unsettled rather than waiting forever. */
const SETTLE_ATTEMPTS = 40;

/** A settled control list, and how many reads it took to get one. */
interface Settled {
  readonly controls: ControlRef[];
  readonly attempts: number;
}

/**
 * Wait until the page's control set stops moving, and return it.
 *
 * ## Why this exists, and it is a real observation rather than a guess
 *
 * **CI run `37446193779` caught it.** The drift reporter added after run `37439940701`
 * fired on a page whose control set was *not* moving for any reason the product controls:
 *
 * ```text
 * position 1 was "Back to the inbox" (index 1), now "Open Message with no subject. …"
 * position 2 was "Replace address"  (index 2), now "Back to the inbox"        (index 2)
 * position 4 appeared: "Clear saved data"
 * ```
 *
 * Read as a diff rather than as a failure, that is **one element inserted above index 1** —
 * the inbox row gaining a layout box after the walk had already begun. Instrumenting the
 * traversal locally showed the same thing on roughly one run in three: the walk started with
 * four controls and the row appeared part-way through. **The page is not unstable** — read
 * eight times a second apart with nothing touching it, the list is identical every time. The
 * window is between the `ready` state rendering and the inbox row being laid out, and the
 * walk's own Tab presses are long enough to fall inside it.
 *
 * So this is a **precondition**, not a retry: the readings in a traversal are only about
 * anything if the set they index is still the set that was enumerated, and waiting for it to
 * stop moving is the only way to establish that. **The drift assertion stays exactly as it
 * was** — it still fails if the set moves *during* the walk, which is the property that
 * matters and the one the browser job originally found a defect through.
 *
 * ## Why it fails rather than returning whatever it last saw
 *
 * A bounded loop that returned its last read on timeout would make every caller believe the
 * page had settled. It throws instead, and the message carries both lists, because a page
 * that genuinely never settles is a fact this suite should report rather than absorb.
 */
async function settledFocusableControls(page: Page): Promise<Settled> {
  let previous = await focusableControls(page);
  let agreeing = 1;

  for (let attempt = 1; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await page.waitForTimeout(SETTLE_POLL_MS);
    const current = await focusableControls(page);

    if (sameNames(previous, current)) {
      agreeing += 1;
      if (agreeing >= SETTLE_STABLE_READS) return { controls: current, attempts: attempt + 1 };
    } else {
      // **A disagreement restarts the count rather than being absorbed.** A control that
      // flickers in and out must not be read as settled between two of its own appearances.
      agreeing = 1;
    }
    previous = current;
  }

  throw new Error(
    `the page's controls never held for ${SETTLE_STABLE_READS} reads in ${SETTLE_ATTEMPTS}: ` +
      `${JSON.stringify(previous.map((control) => control.name))}`,
  );
}

/** Whether two control lists name the same controls in the same order. */
function sameNames(left: readonly ControlRef[], right: readonly ControlRef[]): boolean {
  return (
    left.length === right.length && left.every((control, i) => control.name === right[i]?.name)
  );
}

/** The settle loop's own positive control, and the reason it is not just a retry. */
test("the control set is not walked until it has stopped moving", async ({ page }) => {
  await openSettledMailbox(page);

  // **A control that gains a layout box while the wait is already running.**
  //
  // `display: none` at insertion, made visible 150ms later. The wait reads at 0ms and
  // 100ms — both before it gains a box, so both reads agree — and at 200ms, where it
  // does not. **A wait that returned on the first agreeing pair would return without this
  // control**, and that is precisely the defect the CI run exposed: a traversal that starts
  // on a list that is about to change.
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lateProbe = "";
    button.textContent = "Late probe";
    button.style.display = "none";
    document.body.append(button);
    setTimeout(() => {
      button.style.display = "block";
    }, 150);
  });

  const settled = await settledFocusableControls(page);
  await page.evaluate(() => {
    document.querySelector("button[data-late-probe]")?.remove();
  });

  expect(
    settled.controls.map((control) => control.name),
    "the wait returned before the late control appeared",
  ).toContain("Late probe");
  expect(
    settled.attempts,
    "the wait returned before it had compared the page enough times",
  ).toBeGreaterThanOrEqual(SETTLE_STABLE_READS);
});

/**
 * Read every keyboard-reachable control, unfocused and then focused.
 *
 * ## The traversal, and why each step is a real interaction
 *
 * 1. **Blur**, so no control starts focused and every "unfocused" reading is genuinely
 *    unfocused rather than accidentally on some earlier control.
 * 2. **Read each control while unfocused** — the baseline the focused reading is compared
 *    against, so the assertion can be "this changed" rather than "this equals a value
 *    typed in here". That distinction matters: a browser's own focus ring comes from the
 *    UA stylesheet, so a spec hard-coding one would be testing Chromium's defaults rather
 *    than this page.
 * 3. **Press Tab until the target is the active element**, reading `document.activeElement`
 *    after every press rather than assuming `i` presses reach control `i`. Two presses of
 *    headroom, so a control that cannot be reached is reported as never-reached by the
 *    assertion rather than spinning here.
 *
 * 4. **Re-read the control list afterwards**, and report any drift. The traversal takes
 *    seconds, the page polls while it is open, and a control set that changes mid-walk
 *    makes every reading after the change describe the wrong element. That is not a flake
 *    to be smoothed over — it is a fact about the run, and reporting it is the difference
 *    between a named cause and a missing string in an assertion.
 *
 * ## What it deliberately does not do
 *
 * **It does not fail.** It reports, and the assertions do the failing — which is what lets
 * the negative control reuse these exact readers and be shown the same shape of answer. A
 * reader that threw on a missing indicator would have made that impossible.
 */
async function readFocusableOutlines(page: Page): Promise<Traversal> {
  const controls = (await settledFocusableControls(page)).controls;
  const readings: ControlFocus[] = [];

  for (const control of controls) {
    await blurEverything(page);
    const unfocused = await outlineAt(page, control.index);

    let reached = false;
    for (let press = 0; press <= controls.length + 2 && !reached; press += 1) {
      await page.keyboard.press("Tab");
      reached = await focusIsAt(page, control.index);
    }

    readings.push({ name: control.name, unfocused, focused: await outlineOfFocused(page) });
  }

  const afterwards = await focusableControls(page);
  const drift = describeDrift(controls, afterwards);

  return { readings, drift };
}

/**
 * Whether a reading describes an indicator a person could actually see.
 *
 * **Three conditions, and the third is the one a declaration-only check cannot supply.** A
 * `solid` style at `2px` is invisible if the colour is `transparent` — a real thing authors
 * write to lose the ring while leaving layout untouched — and `outline: none` in a boundary
 * rule cannot detect that, because `transparent` is a valid colour. Only a resolved
 * rendering tells the two apart, which is why that rule documents the limit and this file
 * covers it.
 */
function isVisibleIndicator(reading: OutlineReading): boolean {
  const width = Number.parseFloat(reading.width);
  return reading.style !== "none" && width > 0 && !isInvisible(reading.color);
}

/** `transparent`, or `rgba(0, 0, 0, 0)` — what a browser resolves a transparent colour to. */
function isInvisible(color: string): boolean {
  const trimmed = color.trim();
  if (/^transparent$/i.test(trimmed)) return true;
  return /^rgba\(\s*0(\.0+)?\s*,\s*0(\.0+)?\s*,\s*0(\.0+)?\s*,\s*0(\.0+)?\s*\)$/i.test(trimmed);
}

/**
 * The `rgb()` a browser reports for a token written as `#rrggbb`.
 *
 * **Comparing resolved channels rather than strings.** Chromium may report either
 * `rgb(90, 63, 208)` or a `color(srgb …)` form depending on the channel it parsed, and a
 * string equality assertion between two spellings of the same colour is a test of the
 * browser's formatting rather than of the page. Anything unparseable returns `null` so the
 * assertion fails and says so, rather than silently comparing `null === null`.
 */
function channelsOf(color: string): readonly number[] | null {
  const rgb = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb === null) return null;

  const values = [rgb[1], rgb[2], rgb[3]].map((part) => Number.parseFloat(part as string));
  return values.some((value) => Number.isNaN(value)) ? null : values;
}

/** `#5a3fd0` and `rgb(90, 63, 208)` as the same three channels, or `null`. */
function channelsOfHex(hex: string): readonly number[] | null {
  const match = hex.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (match === null) return null;

  const digits = match[1] as string;
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : digits;

  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
}

/** The failure message, naming the control, so a reader knows what to open. */
function describeControl(focus: ControlFocus): string {
  return `${focus.name} — unfocused ${JSON.stringify(focus.unfocused)}, focused ${JSON.stringify(focus.focused)}`;
}

/**
 * Open the page and wait until every control this milestone styles is actually on it.
 *
 * **`ready` is not enough, and this was found by running the suite rather than by reading
 * it.** The session reaches `ready` once the provider has confirmed an address, and the
 * removal control is offered *later* — only after the page's own write to storage has
 * concluded, because until it has, the page cannot say what is on the device and must not
 * claim it. So a traversal begun at `ready` reads a control list that is still missing a
 * button, and reports it as a control the milestone failed to style.
 *
 * **That is a false reading in the worst direction**, because "this control has no focus
 * indicator" and "this control was not there yet" both arrive as a name absent from a list.
 * The wait is what separates them. Nothing here is weakened by it: the storage spec still
 * establishes the ordering claim on its own, and this spec is only asking what the controls
 * look like.
 */
async function openSettledMailbox(page: Page): Promise<void> {
  await openFreshMailbox(page);
  await expect(page.getByRole("button", { name: "Clear saved data" })).toBeVisible();
}

test.describe("the focus indicator the page actually draws", () => {
  test("every control a mailbox page offers is reachable by keyboard and shows an indicator", async ({
    page,
  }) => {
    await openSettledMailbox(page);

    // ── Plant a control the traversal must not count, BEFORE it traverses
    //
    // A button matching the selector with **no layout box** — `display: none`, the ordinary
    // way a page ends up holding one. It is planted here rather than after the walk because
    // of what it is for: while it exists, the *filtered* position of every control after it
    // differs from its *unfiltered* index, so a traversal that enumerated one list and
    // indexed the other would address the wrong elements from that point on.
    //
    // **This is the defect CI found on the browser job's first run** (run `37439940701`):
    // `names.some(… "Clear saved data")` failing with the head of the list correct and its
    // tail missing — the exact signature of a one-position shift. Nothing on the page as
    // shipped is unrenderable, so **walking the real page cannot distinguish the two
    // indexings at all**: a mutation reintroducing the split (M27) leaves the suite green
    // until this probe exists. It is therefore not a nicety; without it, the repair that
    // fixed the CI failure is the one repair in this file that nothing can catch.
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.probe = "";
      button.textContent = "Unrenderable probe";
      button.style.display = "none";
      // **Prepended, not appended, and that is load-bearing.** Appended to `body` it is the
      // last element in DOM order, so a traversal that counted six matches and indexed only
      // the five rendered ones would address every real control correctly — the shift only
      // happens for what comes *after* the unrenderable element, and appending puts nothing
      // there. A mutation reintroducing that split (M27) therefore left the suite green
      // until this line moved: it was caught by a *different* test, and only because that
      // one happened to plant its own probe earlier in the document.
      document.body.prepend(button);
    });

    // **And the filter drops it**, before the walk rather than after: this is the positive
    // control for `getClientRects()`, and a filter that never filtered would satisfy every
    // assertion below while silently re-creating the defect.
    const withProbe = await focusableControls(page);
    expect(
      withProbe.map((control) => control.name),
      "a control with no layout box must not be enumerated",
    ).not.toContain("Unrenderable probe");

    const { readings, drift } = await readFocusableOutlines(page);
    const names = readings.map((focus) => focus.name);

    // The probe is gone before anything else looks at the page, so no later assertion in
    // this file is made about a page this test altered.
    await page.evaluate(() => {
      document.querySelector("button[data-probe]")?.remove();
    });

    // **The control set did not move while it was being walked.**
    //
    // Checked *first*, and before any claim about what the controls are, because this is
    // the condition under which every other assertion in this file means anything. A
    // traversal whose indices no longer address the elements it enumerated would report a
    // correct page as a page missing a control — which is precisely the failure the browser
    // job produced on its first run in CI, and precisely the failure this assertion is here
    // to name rather than absorb.
    expect(drift, `the page's controls changed mid-traversal:\n${drift.join("\n")}`).toEqual([]);

    // **There are controls, and the ones this milestone expects are among them.** Without
    // this a page rendering no focusable element would satisfy every assertion below
    // vacuously — and a spec that cannot fail is not a spec.
    //
    // Each expectation carries **the list it is searching**, because "received: false" with
    // no list is a reader's guess and a reader's guess is what this repository keeps
    // correcting. A failure names what was there.
    expect(names.length, names.join(" | ")).toBeGreaterThan(0);
    expect(
      names.some((name) => name.includes("Copy address")),
      names.join(" | "),
    ).toBe(true);
    expect(
      names.some((name) => name.includes("Clear saved data")),
      names.join(" | "),
    ).toBe(true);
    // The inbox row carries its subject in the accessible name, so this also proves the
    // row is *reachable by Tab* rather than merely present in the DOM.
    expect(
      names.some((name) => name.includes("one-time code")),
      names.join(" | "),
    ).toBe(true);

    for (const focus of readings) {
      // **The reading describes the control it claims to.** Checked per control, because a
      // name is what every other assertion in this file selects on, and a name attached to
      // another element's outline is a claim nothing else would catch.
      //
      // **This is the invariant the CI failure violated.** Run `37439940701` reported
      // `names.some(… "Clear saved data")` failing while the head of the list was correct —
      // names and outlines that had come apart. Here `unfocused.name` is read from the same
      // element the outline was read from, so the two can only disagree if the enumeration
      // and the readers disagree about which element an index addresses.
      //
      // **Without it, the repair is unfalsifiable.** A mutation handing back the *filtered*
      // position instead of the element's index (M27) was **measured green** while every
      // outcome assertion here still passed — the outline it read belonged to a different
      // control, but a wrong control's outline still looks focused or unfocused, so nothing
      // noticed. Two earlier versions of the same fix were also green: the probe planted
      // *after* the walk shifted nothing, and the probe planted by *appending* shifted
      // nothing either. A property no mutation can break is not a property, and this
      // assertion is what makes the coupling one.
      expect.soft(focus.unfocused.name, describeControl(focus)).toBe(focus.name);

      expect.soft(isVisibleIndicator(focus.focused), describeControl(focus)).toBe(true);

      // **Not `auto` — and this assertion exists because a mutation found the gap.**
      //
      // Deleting this stylesheet's `:focus-visible` rule **entirely** leaves the two
      // assertions above satisfied, which is measured rather than assumed: Chromium's own
      // user-agent stylesheet already draws `outline: auto` on a focused control, so "the
      // control has a visible indicator" can be satisfied by the browser rather than by the
      // page. A mutation that removed the rule was caught by the *next* test and by this
      // one only after this assertion was added — which is the whole reason a mutation is
      // aimed at the assertion and not merely at the file.
      //
      // `auto` is exactly the value that means *whatever the user agent decides*. A page
      // relying on it has not designed a focus state, it has declined to; the indicator it
      // gets can change with a browser upgrade, a platform theme, or a user's own
      // settings, none of which this product controls or has measured. A concrete style is
      // what "this milestone delivers a focus indicator" has to mean if it means anything.
      expect.soft(focus.focused.style, describeControl(focus)).not.toBe("auto");
    }

    // ── One more control: `expect(drift).toEqual([])` on its own is unfalsifiable
    //
    // A reporter that returns `[]` for every input satisfies "the control set did not move"
    // perfectly, forever. This repository's own history is that an assertion of the form
    // "nothing bad happened" is satisfied by a reader that reports nothing for any reason —
    // the defect the negative control at the end of this file exists to catch, turned here
    // on the file's own precondition.
    //
    // So a **renderable** control is added and `describeDrift` is required to name it. The
    // filter's positive control is above, where the probe exists *during* the walk, because
    // that is the only place the two indexings can disagree.
    const beforeProbe = await focusableControls(page);
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.probe = "";
      button.textContent = "Visible probe";
      document.body.append(button);
    });
    const afterProbe = await focusableControls(page);

    expect(afterProbe.map((control) => control.name)).toContain("Visible probe");
    expect(
      describeDrift(beforeProbe, afterProbe).some((line) => line.includes("Visible probe")),
      `describeDrift must report an added control; it reported ${JSON.stringify(
        describeDrift(beforeProbe, afterProbe),
      )}`,
    ).toBe(true);
  });

  test("the indicator is caused by focus, and is absent when the control is not focused", async ({
    page,
  }) => {
    await openSettledMailbox(page);

    const { readings, drift } = await readFocusableOutlines(page);
    expect(drift, `the page's controls changed mid-traversal:\n${drift.join("\n")}`).toEqual([]);
    expect(readings.length).toBeGreaterThan(0);

    for (const focus of readings) {
      // **Each control's own unfocused reading is the comparison**, not a constant typed
      // in here. A spec asserting `outlineStyle === "solid"` would pass on a page whose
      // controls carried a permanent 2px solid outline and no focus behaviour at all — a
      // page that looks correct and is unusable by keyboard. This is the assertion that
      // rules that one out.
      expect.soft(isVisibleIndicator(focus.unfocused), describeControl(focus)).toBe(false);

      const before = channelsOf(focus.unfocused.color);
      const after = channelsOf(focus.focused.color);
      expect
        .soft(
          focus.unfocused.style !== focus.focused.style ||
            focus.unfocused.width !== focus.focused.width ||
            (before !== null && after !== null && before.join() !== after.join()),
          describeControl(focus),
        )
        .toBe(true);
    }
  });

  test("the indicator is painted in the accent the token layer declares", async ({ page }) => {
    await openSettledMailbox(page);

    // **The token resolves, and the drawing matches it.** A misspelled or removed `--focus`
    // would leave every custom property that reads it falling back to nothing, and the
    // outline would silently become `currentColor` — a page that still shows a ring, in the
    // text colour, which is a design change no other assertion here would catch.
    const declared = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--focus").trim(),
    );
    expect(declared).not.toBe("");

    const expectedChannels = channelsOfHex(declared);
    expect(expectedChannels, `--focus is not a hex colour: ${declared}`).not.toBeNull();

    const { readings, drift } = await readFocusableOutlines(page);
    expect(drift, `the page's controls changed mid-traversal:\n${drift.join("\n")}`).toEqual([]);
    const painted = readings.filter((focus) => isVisibleIndicator(focus.focused));
    expect(painted.length, readings.map((focus) => focus.name).join(" | ")).toBeGreaterThan(0);

    for (const focus of readings) {
      if (!isVisibleIndicator(focus.focused)) continue;
      // Every control that draws an indicator draws it in the declared accent — not one in
      // the accent and another in a browser default or a stray literal.
      expect
        .soft(channelsOf(focus.focused.color)?.join(","), describeControl(focus))
        .toBe(expectedChannels?.join(","));
    }
  });

  test("the irreversible confirmation is keyboard-reachable, and its safe action is second", async ({
    page,
  }) => {
    await openSettledMailbox(page);

    await page.getByRole("button", { name: "Clear saved data" }).click();
    await expect(page.getByTestId("local-data-confirmation")).toBeVisible();

    const { readings, drift } = await readFocusableOutlines(page);
    const names = readings.map((focus) => focus.name);

    // **The control set is stable across the traversal**, for the same reason as in the
    // first test: this one reads names out of the walk and would otherwise read a shifted
    // list and report a confirmation that is present as absent.
    expect(drift, `the page's controls changed mid-traversal:\n${drift.join("\n")}`).toEqual([]);

    // **Both actions, and the destructive one reachable without a pointer.** The
    // confirmation is the one place on this page where a mistake cannot be undone, and an
    // indicator is only part of that: if `Remove it` could not be tabbed to, the warning
    // would reach nobody who cannot use a mouse.
    expect(
      names.some((name) => name.includes("Remove it")),
      names.join(" | "),
    ).toBe(true);
    expect(
      names.some((name) => name.includes("Keep it")),
      names.join(" | "),
    ).toBe(true);

    for (const focus of readings) {
      expect.soft(isVisibleIndicator(focus.focused), describeControl(focus)).toBe(true);
    }

    // **"Keep it" is second in the order a keyboard actually meets**, which is how "the
    // destructive action is not the default focus" becomes an observation rather than a
    // comment. Asserted on the traversal order, not on the markup: a markup assertion
    // would be satisfied by an author who reordered the markup and changed nothing else.
    const destructive = names.findIndex((name) => name.includes("Remove it"));
    const safe = names.findIndex((name) => name.includes("Keep it"));
    expect(destructive).toBeGreaterThanOrEqual(0);
    expect(safe).toBeGreaterThan(destructive);
  });

  test("a suppressed indicator is detected, which is what makes the checks above mean anything", async ({
    page,
  }) => {
    await openSettledMailbox(page);

    // **The planted defect is the one the boundary rule forbids, applied to the real
    // page.** It is scoped to `.control:focus-visible` so it silences the copy and removal
    // buttons exactly as an author could — and because it targets the same selector the
    // stylesheet uses, it wins on specificity without needing `!important`, which is what
    // makes this a realistic reproduction rather than an artificial one.
    await page.addStyleTag({ content: "button.control:focus-visible { outline: none; }" });

    const { readings, drift } = await readFocusableOutlines(page);
    // The planted rule removes no controls, so drift here would mean the page changed
    // underneath the reader — which would let "reported nothing" pass as a detection.
    expect(drift, `the page's controls changed mid-traversal:\n${drift.join("\n")}`).toEqual([]);

    const silenced = readings.filter((focus) => !isVisibleIndicator(focus.focused));
    const names = silenced.map((focus) => focus.name);

    // **Named, not merely counted**, so a reader that reported nothing for a different
    // reason — a control it never reached, say — cannot be mistaken for a detection.
    expect(
      names.some((name) => name.includes("Copy address")),
      names.join(" | "),
    ).toBe(true);
    expect(
      names.some((name) => name.includes("Clear saved data")),
      names.join(" | "),
    ).toBe(true);

    // **And the inbox row is NOT silenced**, because the planted rule names `.control` and
    // the row's class is `inbox-row`. A reader that reported *every* control as missing an
    // indicator would satisfy the two assertions above and fail this one — which is what
    // distinguishes detection from a broken reader.
    expect(names.some((name) => name.includes("one-time code"))).toBe(false);
  });
});
