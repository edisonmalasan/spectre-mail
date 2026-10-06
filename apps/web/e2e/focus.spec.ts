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
 * Every keyboard-reachable control, in DOM order, named.
 *
 * **Visibility is measured with `getClientRects()` rather than `offsetParent`.** The
 * latter is `null` for a `position: fixed` element, which is a visible element, so a page
 * that later positions a sticky control would silently drop it from this list and the
 * assertions below would shrink rather than fail.
 */
async function focusableNames(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const label = element.getAttribute("aria-label");
        const source = label !== null && label !== "" ? label : (element.textContent ?? "");
        return source.replace(/\s+/g, " ").trim();
      });
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
 * ## What it deliberately does not do
 *
 * **It does not fail.** It reports, and the assertions do the failing — which is what lets
 * the negative control reuse these exact readers and be shown the same shape of answer. A
 * reader that threw on a missing indicator would have made that impossible.
 */
async function readFocusableOutlines(page: Page): Promise<ControlFocus[]> {
  const names = await focusableNames(page);
  const readings: ControlFocus[] = [];

  for (let target = 0; target < names.length; target += 1) {
    await blurEverything(page);
    const unfocused = await outlineAt(page, target);

    let reached = false;
    for (let press = 0; press <= names.length + 2 && !reached; press += 1) {
      await page.keyboard.press("Tab");
      reached = await focusIsAt(page, target);
    }

    readings.push({ name: unfocused.name, unfocused, focused: await outlineOfFocused(page) });
  }

  return readings;
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

    const readings = await readFocusableOutlines(page);
    const names = readings.map((focus) => focus.name);

    // **There are controls, and the ones this milestone expects are among them.** Without
    // this a page rendering no focusable element would satisfy every assertion below
    // vacuously — and a spec that cannot fail is not a spec.
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((name) => name.includes("Copy address"))).toBe(true);
    expect(names.some((name) => name.includes("Clear saved data"))).toBe(true);
    // The inbox row carries its subject in the accessible name, so this also proves the
    // row is *reachable by Tab* rather than merely present in the DOM.
    expect(names.some((name) => name.includes("one-time code"))).toBe(true);

    for (const focus of readings) {
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
  });

  test("the indicator is caused by focus, and is absent when the control is not focused", async ({
    page,
  }) => {
    await openSettledMailbox(page);

    const readings = await readFocusableOutlines(page);
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

    const readings = await readFocusableOutlines(page);
    const painted = readings.filter((focus) => isVisibleIndicator(focus.focused));
    expect(painted.length).toBeGreaterThan(0);

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

    const readings = await readFocusableOutlines(page);
    const names = readings.map((focus) => focus.name);

    // **Both actions, and the destructive one reachable without a pointer.** The
    // confirmation is the one place on this page where a mistake cannot be undone, and an
    // indicator is only part of that: if `Remove it` could not be tabbed to, the warning
    // would reach nobody who cannot use a mouse.
    expect(names.some((name) => name.includes("Remove it"))).toBe(true);
    expect(names.some((name) => name.includes("Keep it"))).toBe(true);

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

    const readings = await readFocusableOutlines(page);
    const silenced = readings.filter((focus) => !isVisibleIndicator(focus.focused));
    const names = silenced.map((focus) => focus.name);

    // **Named, not merely counted**, so a reader that reported nothing for a different
    // reason — a control it never reached, say — cannot be mistaken for a detection.
    expect(names.some((name) => name.includes("Copy address"))).toBe(true);
    expect(names.some((name) => name.includes("Clear saved data"))).toBe(true);

    // **And the inbox row is NOT silenced**, because the planted rule names `.control` and
    // the row's class is `inbox-row`. A reader that reported *every* control as missing an
    // indicator would satisfy the two assertions above and fail this one — which is what
    // distinguishes detection from a broken reader.
    expect(names.some((name) => name.includes("one-time code"))).toBe(false);
  });
});
