/**
 * Motion, and what stops it.
 *
 * ## What this suite establishes, and what it does not
 *
 * It establishes that the three entrances the roadmap names carry the token layer's own
 * motion values, that `prefers-reduced-motion: reduce` leaves **no element on the page**
 * carrying an animation, and that a row already on the page is not re-materialised by a
 * later poll. Each is read from a **resolved** value — computed style, the CSSOM, or an
 * `animationstart` event — so a stylesheet that merely *declares* the wrong thing is caught
 * where a declaration check alone would not.
 *
 * It establishes **nothing about how the motion looks.** No assertion here reads a rendered
 * pixel. The blur and the rise are numbers in a keyframes block and durations in a computed
 * style; whether four pixels of travel and six of blur read as restrained or as fussy is a
 * human judgement, and this suite does not stand in for it. The same limit already applies
 * to contrast (arithmetic) and to focus (a computed outline).
 *
 * ## Why the reduced-motion half is one test rather than two
 *
 * "No element animates under reduced motion" is satisfied by a page that animates nothing at
 * all. Split across two tests, one of them could pass for that reason and nothing would say
 * so. So the sweep runs **twice in one test** — once with the preference set, once without —
 * over the same function, and the second run is required to find the animations. Deleting
 * the entrances from the stylesheet turns the first half green and the second half red, which
 * is the only shape in which the first half means anything.
 *
 * ## What is deliberately not covered here
 *
 * **A message arriving after the first listing.** Every recorded listing the handler serves
 * is the same one, so no new row ever appears and a new row's entrance is never observed. A
 * fixture that changed between polls would have to be **invented**, and inventing one and
 * calling it recorded would be worse than the gap. What *is* covered is the half that
 * matters for the flicker risk: that an existing row is not re-materialised. The
 * requirement's "a new message arrives" scenario is therefore real and untested here, and is
 * recorded as such rather than quietly satisfied by the neighbouring scenario.
 *
 * ## Two instruments, on purpose
 *
 * The declarations are read from the **file** in Node, and the keyframes are read from the
 * **CSSOM** in the browser. The second is not redundant: the CSSOM reports
 * `blur(var(--blur))` and `blur(6px)` as the two different things they are, where a text
 * pattern has to be told the difference. Frame selection is by **offset** (`0%`, `100%`) —
 * Chromium never reports the `from` and `to` this file is written in terms of, which is how
 * the first version of this read found nothing at all.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { openFreshMailbox, type OpenMailboxOptions } from "./open-mailbox";
import { deferred, type ProviderTraffic } from "./recorded-provider";

/**
 * The longest the session will wait between checks, imported rather than written here.
 *
 * **By relative path into the shared package's source, following
 * `recorded-provider.ts`.** `apps/web` declares `@spectre-mail/mailbox`, but this tier
 * resolves shared source by path and a bare package specifier would ask Playwright's
 * transpiler to compile inside `node_modules`.
 *
 * **It is the ceiling because that is what a ceiling is for.** The second check is
 * scheduled by the product's own cadence, which backs off while nothing changes, so how
 * long the page takes to reach a check in flight is not a property of this spec — it is a
 * property of the session. Sizing the wait from the declared worst case makes exceeding it
 * a failure rather than a race: see the measurement recorded on the wait below.
 */
import { INBOX_POLL_CEILING_MS } from "../../../packages/mailbox/src/cadence";

/** The entrances, named as the requirement names them — by their class hook. */
const ENTRANCE_CLASSES = ["address__value", "inbox-row", "code"] as const;

/** The same three, as the selectors the stylesheet and the page queries use. */
const ENTRANCE_SELECTORS: readonly string[] = ENTRANCE_CLASSES.map((name) => `.${name}`);

/** The duration tokens the token layer declares, read off the page by these names. */
const DURATION_TOKENS = ["--duration-fast", "--duration-base"] as const;

/** The one keyframes block the Motion section declares. */
const KEYFRAMES = "materialise";

/** The preference whose presence must leave nothing moving. */
const REDUCED = "reduce";

/** The preference's absence, which the same sweep must be able to tell apart from it. */
const NOT_REDUCED = "no-preference";

/* ── Reading the stylesheet in Node ───────────────────────────────────────────── */

/**
 * The shipped stylesheet, comments removed.
 *
 * **Comments are removed because several of them name the very things being forbidden** —
 * the header explains that `0.01ms` is not a stop, and the Motion section quotes the
 * roadmap. A literal sweep that counted those would fail on the documentation of the rule it
 * enforces.
 */
function stylesheet(): string {
  const file = fileURLToPath(new URL("../src/styles.css", import.meta.url));
  return readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** One block that declares an `animation`, with the text that introduced it. */
interface AnimationRule {
  /**
   * Every at-rule the block sits inside, outermost first.
   *
   * **A chain rather than one prelude, and that is what the first version got wrong.**
   * Recording only the innermost text means a rule inside `@media (prefers-reduced-motion:
   * reduce)` is reported against its selector with the media query nowhere in the record,
   * so a filter for "rules inside a reduced-motion block" finds nothing and silently
   * asserts that no such block exists. That is the twenty-seventh shape this change has
   * recorded of a check narrower than the rule it documents: it under-reports, which is
   * the direction that invites deleting the rule rather than fixing it.
   */
  readonly atRules: readonly string[];
  /** The selector list the block itself introduced. */
  readonly selector: string;
  /** Where the block begins, so two rules can be compared for order. */
  readonly index: number;
}

/**
 * Every block in the stylesheet whose **own** declarations include an `animation`.
 *
 * A brace walk rather than a regular expression, because the distinction that matters is
 * structural: a declaration belongs to its *innermost* enclosing block, so `.inbox-row`'s
 * animation inside `@media (prefers-reduced-motion: reduce)` is recorded against the
 * selector and not against the media query, and an `@media` block's own (empty) declaration
 * list never absorbs a nested rule's.
 *
 * It walks nesting rather than assuming a depth, because this stylesheet has `@media` blocks
 * containing rules containing keyframe frames, and a walker that stopped at the first `}`
 * would report the reduced-motion block as empty.
 *
 * **Precludes and declarations are kept in parallel stacks rather than one variable, and
 * that is not a detail.** Carrying the prelude in a single variable and reading it when the
 * block closes reads it *after* the block's own children have cleared it, so every rule
 * comes back with an empty selector — and the test then fails reporting no rules at all
 * instead of the wrong ones. This walker's first version did exactly that.
 */
function animationRules(css: string): readonly AnimationRule[] {
  const declarations: string[] = [];
  const chain: string[][] = [];
  const positions: number[] = [];
  const found: AnimationRule[] = [];
  let prelude = "";
  let cursor = 0;

  const flush = (): void => {
    if (declarations.length > 0 && prelude !== "") {
      declarations[declarations.length - 1] += `${prelude} `;
      prelude = "";
    }
  };

  for (const character of css) {
    if (character === "{") {
      const selector = prelude.trim();
      flush();
      declarations.push("");
      // The parent chain **plus** this block's own prelude, captured *before* `flush()`
      // runs — and that ordering is the whole third instance of this defect. `flush()`
      // empties `prelude` into the enclosing block's declarations, so reading it
      // afterwards yields `""`. Top-level rules survived anyway, because `flush()` is a
      // no-op at depth zero, which is why this presented as "the media query's rule has
      // no selector" rather than as "no rule has a selector".
      chain.push([...(chain[chain.length - 1] ?? []), selector]);
      positions.push(cursor);
      prelude = "";
    } else if (character === "}") {
      flush();
      const own = declarations.pop() ?? "";
      const enclosing = chain.pop() ?? [];
      const position = positions.pop() ?? 0;
      if (/[\s;]animation(?:-[a-z-]+)?\s*:/.test(own)) {
        found.push({
          atRules: enclosing.slice(0, -1).filter((entry) => entry.startsWith("@")),
          selector: enclosing[enclosing.length - 1] ?? "",
          index: position,
        });
      }
      prelude = "";
    } else if (character === ";") {
      flush();
    } else {
      // Every character accumulates into one buffer, and `flush()` is what attributes
      // it — to the innermost open block, at each `;` and at each brace. Attributing as
      // the characters arrive instead would need a second buffer per depth, and this way
      // the nesting is decided by the two stacks rather than by a second branch.
      prelude += character;
    }
    cursor += 1;
  }

  return found;
}

/** Split a selector list into its selectors, dropping the whitespace between them. */
function selectors(prelude: string): readonly string[] {
  return prelude
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector !== "");
}

/** The body of a named `@keyframes` block, found by matching braces rather than by a pattern. */
function keyframesBody(css: string, name: string): string {
  const start = css.indexOf(`@keyframes ${name}`);
  expect(start, `the stylesheet declares @keyframes ${name}`).toBeGreaterThan(-1);

  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }

  throw new Error(`@keyframes ${name} has no closing brace`);
}

/* ── Reading the page ─────────────────────────────────────────────────────────── */

/** The animation a selector's element resolves to, or an absent reading when it is not there. */
interface Resolved {
  readonly present: boolean;
  readonly animationName: string;
  readonly durationSeconds: number;
  readonly timingFunction: string;
}

/**
 * Resolve one selector's animation off a live element.
 *
 * **Durations are parsed to numbers rather than compared as strings, and that is measured
 * rather than tidiness:** Chromium resolves a `200ms` duration to `"0.2s"` *and* resolves the
 * `--duration-base` token itself to `".2s"` — it shortens the leading zero in both places,
 * differently. The two strings differ, so a string comparison would report a defect that does
 * not exist. The unit is re-applied from the string rather than assumed, so a `ms` reading
 * would not be read as seconds.
 */
function resolved(page: Page, selector: string): Promise<Resolved> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (element === null) {
      return {
        present: false,
        animationName: "",
        durationSeconds: Number.NaN,
        timingFunction: "",
      };
    }

    const style = getComputedStyle(element);
    const duration = style.animationDuration;
    return {
      present: true,
      animationName: style.animationName,
      durationSeconds: Number.parseFloat(duration) * (duration.trim().endsWith("ms") ? 0.001 : 1),
      timingFunction: style.animationTimingFunction,
    };
  }, selector);
}

/** What the token layer declares on this page, in the units the browser reports. */
interface DeclaredMotion {
  readonly durations: readonly number[];
  readonly timingFunction: string;
}

/**
 * The durations and the easing the **token layer** declares on the page under test.
 *
 * Durations are read straight off the document element, because a time has one spelling per
 * unit and both sides of the comparison are in seconds. The easing cannot be read the same
 * way, and the reason is measured: the `--ease-standard` token resolves to
 * `cubic-bezier(.16, 1, .3, 1)` while a **computed** value resolves to
 * `cubic-bezier(0.16, 1, 0.3, 1)`. Same function, different spelling — Chromium shortens the
 * leading zero in the custom property but not in the resolved value. So the easing is read
 * from a **probe element** whose own declaration is written entirely in terms of the token: it
 * goes through the same normalisation the product's does, and comparing the two tests the
 * **linkage** rather than the spelling. A literal `ease-in-out` on the product's own selector
 * fails here while the token layer is untouched.
 *
 * The probe carries its own reduced-motion override and is removed before this returns, so it
 * can never be seen by the sweep.
 */
function declaredMotion(page: Page): Promise<DeclaredMotion> {
  return page.evaluate((tokens) => {
    const root = getComputedStyle(document.documentElement);
    const durations = tokens.map((token) => {
      const value = root.getPropertyValue(token).trim();
      return Number.parseFloat(value) * (value.endsWith("ms") ? 0.001 : 1);
    });

    const style = document.createElement("style");
    style.textContent = `
      @keyframes motion-probe-enter {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .motion-probe {
        animation: motion-probe-enter var(--duration-base) var(--ease-standard);
      }
      @media (prefers-reduced-motion: reduce) {
        .motion-probe { animation: none; }
      }
    `;
    document.head.append(style);

    const element = document.createElement("div");
    element.className = "motion-probe";
    document.body.append(element);

    const timingFunction = getComputedStyle(element).animationTimingFunction;

    element.remove();
    style.remove();
    return { durations, timingFunction };
  }, DURATION_TOKENS);
}

/** One element that carries an animation, and the animation's name. */
interface Carrying {
  readonly tagName: string;
  readonly classes: readonly string[];
  readonly animationName: string;
}

/**
 * The sweep: every element whose **resolved** `animation-name` is not `none`.
 *
 * **Resolved rather than running, and the difference is deliberate.** An element reports the
 * animation it *carries* for as long as the declaration applies; `document.getAnimations()`
 * lists only the ones *running at this instant*, which for a 120ms entrance is a window a
 * settled page has already left. An assertion that could only pass inside that window would
 * be a race, and this repository has one recorded instance of a green run hiding one. On a
 * settled page the two coincide — there is no animation left to run — and this is the only
 * one of the two a settled page can answer.
 */
function carriedAnimations(page: Page): Promise<readonly Carrying[]> {
  return page.evaluate(() => {
    const carried: { tagName: string; classes: string[]; animationName: string }[] = [];
    for (const element of Array.from(document.querySelectorAll("*"))) {
      const style = getComputedStyle(element);
      if (style.animationName === "none") continue;
      carried.push({
        tagName: element.tagName.toLowerCase(),
        classes: String(element.className).trim().split(/\s+/).filter(Boolean),
        animationName: style.animationName,
      });
    }
    return carried;
  });
}

/** Start recording every `animationstart` the page fires, keyed by the first class. */
async function recordAnimationStarts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const started: string[] = [];
    (window as unknown as { motionStarts: string[] }).motionStarts = started;
    document.addEventListener("animationstart", (event) => {
      const animation = event as AnimationEvent;
      const target = event.target as Element | null;
      // **The first class, not the whole `className`.** A row carries a modifier
      // (`inbox-row inbox-row--carries`) that depends on what the message holds, so
      // keying on the full string would make this recorder's expectations depend on
      // whether the fixture's message happened to carry a code.
      started.push(`${animation.animationName} on ${target?.classList.item(0) ?? "?"}`);
    });
  });
}

/** Forget anything recorded so far, without unhooking the recorder. */
async function forgetAnimationStarts(page: Page): Promise<void> {
  await page.evaluate(() => {
    // **Truncate in place, never reassign.** The listener closes over the array it was
    // given, so assigning a fresh array to `window` leaves the recorder pushing into an
    // object nothing reads — and every reading afterwards is permanently empty. That is
    // not a hypothetical: it is what this helper did, and it turned the "no animation
    // starts" half of the recorder test into an assertion that could not fail while
    // looking exactly like one that could. The failure was in the *other* direction —
    // a permanently empty log also breaks a `toContain` — but a test whose recorder can
    // go deaf mid-run is a test whose silence means nothing.
    const recorded = (window as unknown as { motionStarts?: string[] }).motionStarts;
    if (recorded !== undefined) recorded.length = 0;
  });
}

/** The `animationstart` events recorded since the recorder was last reset. */
function animationStarts(page: Page): Promise<readonly string[]> {
  return page.evaluate(
    () => (window as unknown as { motionStarts?: readonly string[] }).motionStarts ?? [],
  );
}

/** How many listing responses the recorded handler has served so far. */
function listingsServed(traffic: ProviderTraffic): number {
  return traffic.served.filter((url) => url.includes("f=check_email")).length;
}

/**
 * Open the page with the recorder already attached, so nothing is missed.
 *
 * The recorder goes in through `openFreshMailbox`'s documented hook rather than by
 * navigating again here, because this tier has exactly one copy of "load the page and
 * wait for a mailbox" and a second would be allowed to drift from it.
 */
function openRecordingFrom(
  page: Page,
  options: Omit<OpenMailboxOptions, "onDocumentLoaded"> = {},
): Promise<ProviderTraffic> {
  return openFreshMailbox(page, { ...options, onDocumentLoaded: recordAnimationStarts });
}

/**
 * Wait until the row's entrance has actually been **observed**, then forget it.
 *
 * **A measured precondition, and the weaker shapes were tried first.** Two agreeing
 * reads 100ms apart are a delay with a comparison in it, not a precondition — and
 * polling `document.getAnimations()` until it reaches zero fails on a page that has not
 * started its entrance yet, because zero is also what "has not begun" reports. The only
 * reading that cannot be confused with the other is the entrance itself having been
 * seen. It is this repository's third recorded instance of that shape, and the second
 * authored and caught inside a single change.
 */
async function forgetTheRowEntrance(page: Page): Promise<void> {
  await expect
    .poll(() => animationStarts(page), { timeout: 30_000 })
    .toContain(`${KEYFRAMES} on inbox-row`);
  await forgetAnimationStarts(page);
  // Nothing left running, so a later `animationstart` can only be a later entrance.
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 30_000 })
    .toBe(0);
}

/** Open the one recorded message, which is the only way a `.code` reaches the page. */
async function openTheRecordedMessage(page: Page): Promise<void> {
  await page.locator(".inbox-row").first().click();
  await expect(page.getByTestId("message-code")).toBeVisible();
}

/* ── What the stylesheet declares ─────────────────────────────────────────────── */

test("no shipped stylesheet names a duration, an easing function, or a motion distance literally", () => {
  const css = stylesheet();

  // A time literal in either unit. `max-width: 34rem` and `translateY(1px)` are lengths, and
  // `34rem` does not match because the unit has to be `ms` or `s`.
  const times = css.match(/(?<![\w.-])\d+(?:\.\d+)?m?s\b/g) ?? [];
  expect(times, "a shipped stylesheet must not name a duration literally").toEqual([]);

  // An easing function. The token layer holds the one this product uses; a stylesheet that
  // spells one out has restated it, and a restated value is a value that will be changed in
  // one of two places.
  const easings = css.match(/cubic-bezier\(/g) ?? [];
  expect(easings, "a shipped stylesheet must not name an easing function literally").toEqual([]);

  // A motion distance, scoped to the keyframes block. Inside a keyframes block there is no
  // layout, so a length there is unambiguously motion geometry. Outside one, a length is a
  // layout decision, and `translateY(1px)` and `max-height: 28rem` are both legitimate —
  // which is the whole reason this sweep is scoped rather than file-wide.
  const lengths =
    keyframesBody(css, KEYFRAMES).match(/(?<![\w.-])\d+(?:\.\d+)?(?:px|rem|em|ch|ex)\b/g) ?? [];
  expect(lengths, "a keyframes block must not name a distance literally").toEqual([]);
});

test("nothing in the stylesheet sets a transition", () => {
  // **Not decoration, and not a claim that transitions are wrong.** This is what keeps the
  // reduced-motion requirement's silence about transitions honest: an element with no
  // transition reports `transition-duration: 0s`, so a check asserting that would pass on a
  // page with no transitions at all. If a transition is added here, this goes red and the
  // obligation to govern it under the preference has to be met in the same change.
  const transitions = stylesheet().match(/(?<![\w-])transition(?:-[a-z-]+)?\s*:/g) ?? [];
  expect(transitions, "this slice declares no transition, and the requirement says so").toEqual([]);
});

test("the entrances and the block that stops them name the same selectors, and the stop comes last", () => {
  const rules = animationRules(stylesheet());

  const entrances = rules.filter((rule) => rule.atRules.length === 0);
  const reduced = rules.filter((rule) =>
    rule.atRules.some((atRule) => atRule.includes("prefers-reduced-motion: reduce")),
  );

  expect(
    entrances.flatMap((rule) => selectors(rule.selector)).sort(),
    "every rule declaring an animation outside a media query",
  ).toEqual([...ENTRANCE_SELECTORS].sort());

  expect(
    reduced.flatMap((rule) => selectors(rule.selector)).sort(),
    "the selectors the reduced-motion block stops",
  ).toEqual([...ENTRANCE_SELECTORS].sort());

  // **Neither list may be empty, and that is asserted rather than assumed.** A walker
  // that lost track of its own nesting would return no rules for one of these filters,
  // and `[]` sorted equals nothing that would make either assertion above interesting.
  expect(entrances, "the entrances must not be found by absence").not.toEqual([]);
  expect(reduced, "the reduced-motion block must not be found by absence").not.toEqual([]);

  // **Order, and it is load-bearing rather than cosmetic.** Equal specificity means source
  // order decides, so a reduced-motion block placed above the entrances would leave all three
  // animating under the preference — the exact defect the milestone exists to prevent,
  // introduced by moving two blocks. Nothing would look broken; the page would simply move
  // when the user asked it not to. The browser sweep would catch that too, and this catches
  // it in the file, before anything is served.
  const lastEntrance = Math.max(...entrances.map((rule) => rule.index));
  for (const rule of reduced) {
    expect(rule.index, "the reduced-motion block must come after every entrance").toBeGreaterThan(
      lastEntrance,
    );
  }
});

/* ── What the page resolves ───────────────────────────────────────────────────── */

test("the keyframes read the token layer rather than a literal", async ({ page }) => {
  await openFreshMailbox(page);

  const frames = await page.evaluate((name) => {
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSKeyframesRule) || rule.name !== name) continue;
        return Array.from(rule.cssRules).map((frame) => {
          const keyframe = frame as CSSKeyframeRule;
          const read = (property: string): string =>
            keyframe.style.getPropertyValue(property).trim();
          return {
            keyText: keyframe.keyText,
            opacity: read("opacity"),
            filter: read("filter"),
            transform: read("transform"),
          };
        });
      }
    }
    return [];
  }, KEYFRAMES);

  // **Frames are found by offset, and that is not a style choice.** Chromium reports a
  // keyframe's selector as `0%` and `100%` and never as the `from` and `to` this stylesheet is
  // written in terms of. A read keyed on `from` finds nothing at all — which is what the
  // first version of this measurement did, and it read as "the CSSOM exposes nothing" until
  // the cause was found.
  expect(frames.map((frame) => frame.keyText)).toEqual(["0%", "100%"]);

  const [from, to] = frames;
  expect(from?.opacity).toBe("0");
  // The `from` frame is asserted as an exact string because that is the property the
  // requirement turns on: the CSSOM reports `blur(var(--blur))` for a declaration written
  // with the token and `blur(6px)` for one written with a literal, and it is the browser
  // making the distinction, not a pattern.
  expect(from?.filter).toBe("blur(var(--blur))");
  expect(from?.transform).toBe("translateY(var(--rise))");
  expect(to?.opacity).toBe("1");
  expect(to?.transform).toBe("none");

  // The settled frame's blur is matched rather than compared, because Chromium serialises a
  // zero length as `0px` whether the source wrote `0` or `0px` — measured, not assumed, and
  // the stylesheet writes the shorter one. What the assertion rules out is a settled frame
  // that still blurs, or that names no filter at all.
  expect(to?.filter).toMatch(/^blur\(0(?:px)?\)$/);

  // The two distances, read off the live page rather than out of the token layer's source.
  // This is the only assertion that pins them to the roadmap's figures, and it is here rather
  // than in a unit test because a unit test would read the source while this reads what the
  // page actually resolved.
  const declared = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      blur: root.getPropertyValue("--blur").trim(),
      rise: root.getPropertyValue("--rise").trim(),
    };
  });
  expect(declared).toEqual({ blur: "6px", rise: "4px" });
});

test("the three entrances carry declared durations and the declared easing", async ({ page }) => {
  await openFreshMailbox(page);
  await openTheRecordedMessage(page);

  const declared = await declaredMotion(page);
  const used = new Set<number>();

  for (const selector of ENTRANCE_SELECTORS) {
    const reading = await resolved(page, selector);
    expect(reading.present, `${selector} is on the page`).toBe(true);
    expect(reading.animationName, `${selector} names the materialisation`).toBe(KEYFRAMES);
    expect(declared.durations, `${selector}'s duration is one the token layer declares`).toContain(
      reading.durationSeconds,
    );
    expect(reading.timingFunction, `${selector}'s easing is the one the token layer declares`).toBe(
      declared.timingFunction,
    );
    used.add(reading.durationSeconds);
  }

  // **Both ways, and the second is the half a membership check leaves out.** Asserting only
  // that each entrance uses *a* declared duration would stay green if a duration token were
  // declared and never read — which is exactly the state M7 slice 1 shipped, and exactly the
  // state this change exists to end. So the set of durations the entrances use must be the set
  // the token layer declares, with no token left over.
  expect(
    [...used].sort((a, b) => a - b),
    "every declared duration is used by an entrance, and no entrance invents one",
  ).toEqual([...declared.durations].sort((a, b) => a - b));
});

test("no element carries an animation under reduced motion, and the same sweep finds them without it", async ({
  page,
}) => {
  await openFreshMailbox(page);
  await openTheRecordedMessage(page);

  // **First, without the preference**, so the half below cannot be satisfied by a page that
  // animates nothing. A sweep that finds nothing here is a sweep with no power, and the
  // assertion after it would be theatre.
  await page.emulateMedia({ reducedMotion: NOT_REDUCED });
  const withoutPreference = await carriedAnimations(page);
  const carriedClasses = withoutPreference.flatMap((entry) => entry.classes);
  for (const entrance of ENTRANCE_CLASSES) {
    expect(
      carriedClasses,
      `the sweep must find .${entrance} when the preference is not set`,
    ).toContain(entrance);
  }
  for (const entry of withoutPreference) {
    expect(
      entry.animationName,
      `${entry.tagName}.${entry.classes.join(".")} runs the materialisation`,
    ).toBe(KEYFRAMES);
  }

  // Now the preference, over the same page and the same function.
  await page.emulateMedia({ reducedMotion: REDUCED });
  const withPreference = await carriedAnimations(page);
  expect(
    withPreference.map((entry) => `${entry.tagName}.${entry.classes.join(".")}`),
    "no element on the page may carry an animation under reduced motion",
  ).toEqual([]);

  // The tripwire, and it is vacuous today by construction: nothing here declares a
  // transition, so every element reports the initial `0s`. It is asserted because the day a
  // transition is added this stops being vacuous — and the file-level test above is what
  // makes that day loud.
  const transitionDurations = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .map((element) => getComputedStyle(element).transitionDuration)
      .filter((value) => value !== "0s"),
  );
  expect(transitionDurations, "vacuous today, by construction; see the comment").toEqual([]);
});

test("a materialisation starts when a code appears, and none starts under reduced motion", async ({
  page,
}) => {
  // Two halves of one property, in one test for the reason the sweep is: "no animation starts"
  // is satisfied by an entrance that never existed.
  await openRecordingFrom(page);

  // The row's own entrance observed and forgotten first, because `ready` arrives before
  // the inbox has rendered — so forgetting without this would let the row's entrance
  // land *after* the reset and read as part of the click.
  await forgetTheRowEntrance(page);
  await page.emulateMedia({ reducedMotion: NOT_REDUCED });
  await forgetAnimationStarts(page);
  await openTheRecordedMessage(page);
  await expect.poll(() => animationStarts(page)).toContain(`${KEYFRAMES} on code`);

  const started = await animationStarts(page);
  expect(started.length, "the recorded message's codes materialised").toBeGreaterThan(0);
  // **Every recorded start is a code, and nothing else is.** Asserting the exact list
  // would pin the fixture's code count into the assertion — the recorded message carries
  // two, so the list is `["materialise on code", "materialise on code"]` today and would
  // break for a reason that has nothing to do with motion.
  expect(new Set(started), "opening a message materialises its codes and nothing else").toEqual(
    new Set([`${KEYFRAMES} on code`]),
  );

  // And the navigation half, under the *same* preference, so it is not vacuous.
  // `App.tsx` renders `MessageView` after `Inbox` rather than in place of it, so the
  // inbox is never unmounted by opening a message — verified by reading the component
  // rather than assumed, and this is what checks the assumption on the built page.
  await forgetAnimationStarts(page);
  await page.getByRole("button", { name: "Back to the inbox" }).click();
  await expect(page.locator(".inbox-row").first()).toBeVisible();
  expect(await animationStarts(page), "returning to the inbox materialises no row").toEqual([]);

  // And the negative half, on a page that has just proved it animates.
  await page.emulateMedia({ reducedMotion: REDUCED });
  await forgetAnimationStarts(page);
  await page.getByRole("button", { name: "Back to the inbox" }).click();
  await page.locator(".inbox-row").first().click();
  await expect(page.getByTestId("message-code")).toBeVisible();
  // One frame, so an animation that started and finished inside the click would have been
  // recorded rather than missed.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))),
  );
  expect(await animationStarts(page), "no animation starts under reduced motion").toEqual([]);
});

test("the preference is honoured without a reload, in both directions", async ({ page }) => {
  await openRecordingFrom(page);
  await forgetTheRowEntrance(page);
  const before = page.url();

  await page.emulateMedia({ reducedMotion: NOT_REDUCED });
  expect((await resolved(page, ".inbox-row")).animationName).toBe(KEYFRAMES);

  await page.emulateMedia({ reducedMotion: REDUCED });
  expect((await resolved(page, ".inbox-row")).animationName).toBe("none");

  await page.emulateMedia({ reducedMotion: NOT_REDUCED });
  expect((await resolved(page, ".inbox-row")).animationName).toBe(KEYFRAMES);

  // The page was never reloaded and never navigated — asserted rather than assumed, because
  // "without a reload" is the whole content of this scenario.
  expect(page.url()).toBe(before);
});

test("a row already on the page is not re-materialised by a later poll", async ({ page }) => {
  /**
   * **The repair is to wait for the state, and the hold is what makes the wait
   * dependable.** The first version of this test waited for the recorded handler to be
   * *asked* for a second listing and then read the row — and it passed on a build that
   * rebuilt the row on every poll, which was measured: a mutation that inserts the
   * re-checking sentence *above* the list, so the `<ul>` moves to a new index and React
   * rebuilds it, left this test green.
   *
   * **Why it passed, and the shape is the same one the focus traversal's settle
   * precondition had.** `served` is pushed *before* the response is fulfilled, so the
   * test was reading the row during the window *before* the page had published
   * `checking`. The defect this test exists to catch only exists during `checking`, so
   * the reading happened before the fact and passed. A precondition that is a delay
   * rather than a wait for the thing being measured does not fail; it measures the wrong
   * moment.
   *
   * **What the hold is and is not, because the first draft of this comment got it wrong
   * and `design.md` D18 carries the correction.** Holding the second listing turns
   * `checking` from a window a poll may straddle into a state the page is *observed in*,
   * and it is the same instrument `apps/web/src/Inbox.test.tsx` already uses through its
   * `holdListing` stub gate. **But it is not what catches the rebuild**: with the rebuild
   * defect applied *and* this hold removed, the suite still catches it — 4 runs, 4 caught.
   * What catches it is the wait below. The hold is worth keeping because without it the
   * wait is satisfied only about two times in three.
   */
  const secondListing = deferred();
  const traffic: ProviderTraffic = await openRecordingFrom(page, {
    // The first listing is answered at once: it is the one that puts a row on the page,
    // and holding it would mean there were no rows to mark.
    listingGate: (call) => (call === 2 ? secondListing.promise : undefined),
  });

  // The entrance observed and then forgotten, so the recorder below cannot be credited
  // with it and cannot be blamed for missing a later one.
  await forgetTheRowEntrance(page);

  const row = page.locator(".inbox-row").first();
  await row.evaluate((element) => {
    // **A JS property rather than an attribute, deliberately.** Both were measured on the
    // built page before the repair, and both survived — and both vanished together when
    // the row was rebuilt. The property is the one used because nothing in React
    // reconciles it, so a red result can only mean the node changed rather than a
    // framework detail having tidied up after itself.
    (element as unknown as { motionMarker?: string }).motionMarker = "kept";
  });

  const served = listingsServed(traffic);
  expect(served, "the recorded handler has served the first listing").toBeGreaterThan(0);

  // **The precondition, waited for rather than inferred: the page is inside a check that
  // has not been answered.** If this never became visible the test would fail here
  // rather than proceed, which is what makes the gate a precondition and not a sleep —
  // a gate that stopped working fails the wait instead of quietly passing the reading.
  //
  // **The wait is sized from the session's own ceiling, and that was measured rather than
  // guessed.** A first version left Playwright's 5-second default and went **red in 6 of
  // 10 consecutive full-suite runs**, every time on this line. The cause is the cadence:
  // the second check is scheduled `INBOX_POLL_PROMPT_MS` after the first, which is exactly
  // the default timeout, so the wait and the poll raced — and the four runs that passed
  // were luck, not a property. Raising a timeout to a number chosen to be big enough would
  // have been the same defect with a larger constant, so the number is the one the product
  // declares it will never exceed.
  await expect(
    page.getByTestId("inbox-rechecking"),
    "the page entered a check in flight",
  ).toBeVisible({ timeout: INBOX_POLL_CEILING_MS });

  // **And now the claim, read during the window the defect lives in.** Element identity,
  // not appearance: a settled row and a re-materialised row look identical, so a visual
  // check would pass on the defect this exists to catch — a page that replaced every row
  // on every poll would flicker several times a minute for as long as the tab is open. A
  // marker set on the node cannot survive the node being replaced.
  expect(
    await row.evaluate((element) => (element as unknown as { motionMarker?: string }).motionMarker),
    "the row on screen during a check in flight is the node that was already there",
  ).toBe("kept");

  secondListing.release();

  // After it settles: still the same node, and nothing started.
  await expect(page.getByTestId("inbox-rechecking")).toHaveCount(0, {
    timeout: INBOX_POLL_CEILING_MS,
  });
  expect(
    await row.evaluate((element) => (element as unknown as { motionMarker?: string }).motionMarker),
    "the row survived the check that followed it",
  ).toBe("kept");
  expect(await animationStarts(page), "a second identical listing starts nothing").toEqual([]);
  expect(traffic.denied, "the page reached no origin the handler has no recording of").toEqual([]);
});
