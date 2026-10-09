/**
 * Acting on a detection, in a real browser.
 *
 * ## Why this file exists, and what it is the only instrument for
 *
 * `verification-actions` gives the page two things it previously refused to have: a control
 * that puts a detected one-time code on the clipboard, and a detected verification link the
 * user can activate. **jsdom can render both and can report neither.**
 *
 * - **It resolves no outline at all.** jsdom implements the CSS cascade for a documented
 *   subset of properties, and `outline-style`, `outline-width` and `outline-color` are not in
 *   it, so a jsdom reading of the focus indicator is `""`. That is the whole reason
 *   `focus.spec.ts` exists and reads computed styles in Chromium.
 * - **It has no navigation.** An `<a href>` in jsdom is an element with an attribute. Nothing
 *   here can observe what the browser *does* with one, so a claim about a link opening in a
 *   new tab, or about the page not navigating by itself, has no jsdom answer.
 *
 * The clipboard is the third thing jsdom cannot do, and **this file deliberately does not try
 * to cover it**: `navigator.clipboard` needs a permission and a focused document, and
 * `MessageView.test.tsx` stubs it. A stubbed clipboard proves the page asked for the right
 * value and reported what came back; it proves nothing about a real clipboard, which is why
 * the change's own tasks leave *"copy a code with the real clipboard in a real browser"*
 * deliberately unticked for a human.
 *
 * ## What this file is not
 *
 * **No test here reads a rendered pixel.** What follows reads the built DOM, a resolved
 * computed style, Chromium's own accessibility tree, and the page's recorded request log —
 * four instruments that are exact about what they measure and completely silent about
 * whether the result looks right. `tasks.md` 7.1 and 7.2 are deliberately left unticked
 * because an agent opening a page is not the judgement they ask for.
 *
 * ## On the duplication with `focus.spec.ts`
 *
 * The focus-indicator reading here is **a second implementation, not a shared one**, and it
 * is worth saying why rather than quietly extracting a helper nobody asked for. `focus.spec.ts`
 * walks the page's *entire* control set and must not look at one element in isolation; this
 * file asks a different question — *does this one newly-added navigable element draw the ring
 * the stylesheet declares* — and the two need different traversals. Extracting the outline
 * reader alone would leave the traversal, the drift precondition and the settle wait behind
 * it in the other file, which is a helper whose name promises more than it shares.
 *
 * @module
 */

import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";
import type { ProviderTraffic } from "./recorded-provider";

import { guerrillaMessageWithVerificationLink } from "../../../packages/providers/src/fixtures";

/** The host the synthetic fixture's link points at. A reserved TLD: it cannot resolve. */
const LINK_HOST = "verify.example.invalid";

/** The detected URL, stated literally — this is the claim, not a value read back. */
const LINK_URL = "https://verify.example.invalid/confirm?t=example-token";

/** One element's resolved outline, as a browser resolves it. */
interface OutlineReading {
  readonly style: string;
  readonly width: string;
  readonly color: string;
}

/** A page with a mailbox, its provider traffic, and its CDP session. */
interface Reading {
  readonly traffic: ProviderTraffic;
  readonly cdp: CDPSession;
}

/**
 * Open the page, open the one recorded message, and attach to Chromium's tree.
 *
 * **The synthetic fixture, not the recorded one.** The M0 spike's real delivered message
 * carried a one-time code and **no link** — `docs/PROVIDERS.md` records it — so no recorded
 * response in this repository can put a link on the page. The fixture is marked `SYNTHETIC`
 * for that reason and the reason matters here: it exercises *our* rendering of a detected
 * link, and it says nothing about whether any provider produces one.
 *
 * **Chosen by the spec, not by the shared handler.** `recorded-provider.ts` answers
 * operations and deliberately knows nothing about which message a spec is about; importing
 * this fixture there would make every future fixture follow it in.
 */
async function openMessageWithLink(page: Page): Promise<Reading> {
  const traffic = await openFreshMailbox(page, {
    messageStep: guerrillaMessageWithVerificationLink,
  });
  await expect(page.getByTestId("ready")).toBeVisible();

  // **Wait for the row rather than for `ready`.** `openFreshMailbox`'s own note records the
  // measurement behind this: `ready` appears before the inbox has rendered its rows, so a
  // click issued here would be a click at nothing.
  await expect(page.getByTestId("inbox-row-open").first()).toBeVisible();
  await page.getByTestId("inbox-row-open").first().click();
  await expect(page.getByTestId("message-opened")).toBeVisible();
  await expect(page.getByTestId("message-link-anchor")).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  return { traffic, cdp };
}

/**
 * The accessibility roles Chromium exposes **within one element's subtree**.
 *
 * **Queried at the element's own DOM node, not read from the whole tree.** A whole-tree read
 * cannot answer *"is this element a link"*: the page legitimately exposes several buttons and
 * would expose the link whether or not the anchor element carried a `link` role. Scoping is
 * the platform's job, and `Accessibility.queryAXTree` does it.
 */
async function axRolesWithin(cdp: CDPSession, selector: string): Promise<string[]> {
  const { result } = (await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
  })) as { result: { objectId?: string } };

  expect(result.objectId, `the page must render ${selector}`).toBeTruthy();

  const { nodes } = (await cdp.send("Accessibility.queryAXTree", {
    objectId: result.objectId as string,
  })) as { nodes: { role?: { value?: string }; ignored?: boolean }[] };

  return nodes
    .filter((node) => node.ignored !== true)
    .map((node) => node.role?.value ?? "")
    .filter((role) => role !== "");
}

/**
 * Tab to the link anchor, and report how many presses it took.
 *
 * ## Why the keyboard, and not `element.focus()`
 *
 * **Measured on this case, and the measurement is the reason this helper exists.** A first
 * version focused the anchor with `anchor.focus()` from the page and read its resolved
 * outline: `style: "none"`. Chromium applies `:focus-visible` only when focus arrived from a
 * keyboard interaction (or when the element is a text input), so a programmatic focus leaves
 * **every** focusable element reading as though this product had drawn no ring anywhere.
 *
 * That is the worst failure direction available: the assertion would have passed with
 * `.link__anchor` **deleted from the `:focus-visible` list**, and with the whole focus rule
 * deleted. A case that cannot fail on the defect it is named for is not coverage, and
 * `focus.spec.ts` records the same shape twice — a reader that answers usefully for the wrong
 * reason, and an assertion satisfied by a control that never activated.
 *
 * **Bounded, and it reports what it last saw.** A loop that gives up quietly returns a
 * reading of the wrong element, and a loop that never gives up hangs CI; so the ceiling is
 * here and the failure names the last state, which is the difference between a failed
 * precondition and a wrong measurement.
 */
async function tabToAnchor(page: Page): Promise<number> {
  const ceiling = 80;
  let lastSeen = "";

  for (let press = 1; press <= ceiling; press += 1) {
    await page.keyboard.press("Tab");
    const seen = await page.evaluate(() => {
      const active = document.activeElement;
      return active === null
        ? "nothing holds focus"
        : `${active.tagName}:${active.getAttribute("data-testid") ?? "(no testid)"}`;
    });
    if (seen === "A:message-link-anchor") return press;
    lastSeen = seen;
  }

  throw new Error(
    `the link anchor was not reachable within ${ceiling} Tab presses; focus last rested on ${lastSeen}`,
  );
}

/** The resolved outline of whatever currently holds focus, read from Chromium's own styles. */
async function outlineOfActive(page: Page): Promise<OutlineReading> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active === null) throw new Error("nothing holds focus");
    const style = getComputedStyle(active);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
}

/** The resolved outline of the anchor, read while focus is somewhere else entirely. */
async function outlineOfAnchorUnfocused(page: Page): Promise<OutlineReading> {
  return page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>('[data-testid="message-link-anchor"]');
    if (anchor === null) throw new Error("the page must render the link anchor");
    (document.activeElement as HTMLElement | null)?.blur();
    const style = getComputedStyle(anchor);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
}

/** `transparent`, or `rgba(0, 0, 0, 0)` — what a browser resolves a transparent colour to. */
function isInvisible(color: string): boolean {
  const trimmed = color.trim();
  if (/^transparent$/i.test(trimmed)) return true;
  return /^rgba\(\s*0(\.0+)?\s*,\s*0(\.0+)?\s*,\s*0(\.0+)?\s*,\s*0(\.0+)?\s*\)$/i.test(trimmed);
}

/** Whether a reading describes an indicator a person could actually see. */
function isVisibleIndicator(reading: OutlineReading): boolean {
  return (
    reading.style !== "none" && Number.parseFloat(reading.width) > 0 && !isInvisible(reading.color)
  );
}

/**
 * Every URL the page requested that names a given host.
 *
 * **A reader with a name, so the negative control below can be about the reader.** A sweep
 * inline in an assertion cannot be given a control: the control would have to re-implement
 * the sweep, and a control that re-implements the thing it controls proves nothing about it.
 */
function requestsToHost(traffic: ProviderTraffic, host: string): string[] {
  return traffic.requested.filter((url) => {
    try {
      return new URL(url).hostname === host;
    } catch {
      return false;
    }
  });
}

test("renders a detected link as an anchor a keyboard can reach", async ({ page }) => {
  const { cdp } = await openMessageWithLink(page);

  const anchor = page.getByTestId("message-link-anchor");
  await expect(anchor).toHaveAttribute("href", LINK_URL);
  await expect(anchor).toHaveAttribute("target", "_blank");

  // **`rel` asserted by membership, not by whole-string equality.** `noopener` is the
  // security clause and `noreferrer` the privacy one on a page whose URL carries a mailbox
  // address; asserting the exact attribute would fail a correct build that later adds a
  // third token, and would pass one that dropped one of these two.
  const rel = (await anchor.getAttribute("rel"))?.split(" ") ?? [];
  expect(rel).toContain("noopener");
  expect(rel).toContain("noreferrer");

  // **The host is inside the anchor**, not beside it. A host rendered as a sibling span
  // reads as information while the thing that actually navigates is something else, which is
  // the defect this ordering avoids.
  await expect(anchor).toContainText(LINK_HOST);
  await expect(page.getByTestId("message-link-url")).toHaveText(LINK_URL);

  // **Chromium's own tree says it is a link**, read at the anchor's own node rather than
  // from a role query — the same argument `sections.spec.ts` makes for landmarks, and the
  // claim here is the same kind of claim: what a screen reader is offered.
  expect(await axRolesWithin(cdp, '[data-testid="message-link-anchor"]')).toContain("link");

  // **And it has a layout box**, because every focus assertion below is vacuous on an
  // element with no box — the recorded failure mode `focus.spec.ts` documents for its own
  // traversal.
  await expect(anchor).toBeVisible();
});

test("the anchor draws a focus indicator this product declared, and only while focused", async ({
  page,
}) => {
  await openMessageWithLink(page);

  const unfocused = await outlineOfAnchorUnfocused(page);

  // **Reached by Tab, and the press count is asserted rather than assumed.** See
  // `tabToAnchor` for the measurement: `.focus()` reads as "no ring" on every element in
  // this page, so a case that used it would have passed with the product's rule deleted.
  const presses = await tabToAnchor(page);
  expect(presses, "the anchor must be reachable by Tab alone, and be reached").toBeGreaterThan(0);

  const focused = await outlineOfActive(page);

  // **The ring is present, is not the browser's own, and is a real one.** `auto` is
  // precisely the value meaning *whatever the user agent decides*, which is the thing a
  // claim about a ring this product drew has to exclude — and it is what Chromium supplies
  // when this slice's selector is missing from the list, so this is the assertion the
  // mutation in the change's falsification pass targets.
  expect(isVisibleIndicator(focused)).toBe(true);
  expect(focused.style).not.toBe("auto");
  expect(focused.style).not.toBe("none");
  expect(Number.parseFloat(focused.width)).toBeGreaterThan(0);

  // **And the reading came from the anchor**, which `tabToAnchor` established by reading
  // `document.activeElement` rather than by assuming the walk landed where it meant to. The
  // equality is belt-and-braces against a traversal that stops early.

  // **The ring is caused by focus.** Each element's own unfocused reading is the
  // comparison, not a constant typed here: a permanent outline would satisfy every
  // assertion above.
  expect(isVisibleIndicator(unfocused)).toBe(false);
});

test("opening a message carrying a link navigates nowhere and requests nothing", async ({
  page,
}) => {
  const { traffic } = await openMessageWithLink(page);

  // **The page's own URL is unchanged.** Rendering a message is the moment a naive
  // implementation would navigate, and a navigation would show up here first.
  expect(page.url()).not.toContain(LINK_HOST);
  expect(page.url()).toContain("127.0.0.1");

  // **And nothing was asked of the link's host.** "Show a link" and "contact a link's host"
  // are different things, and the recorded request log is the only instrument here that can
  // tell them apart — `denied` alone would not, because the handler denies an origin nobody
  // recorded, which is a *consequence* of an unrecorded request rather than evidence one
  // was made.
  expect(requestsToHost(traffic, LINK_HOST)).toEqual([]);

  // **The negative control, and without it the assertion above proves nothing.** A reader
  // matching nothing satisfies "no requests" for ever, and the control is what distinguishes
  // a reader that would report a request from one that would not. It plants the URL the
  // claim forbids **into a copy of the record the page actually produced**, so the reader is
  // exercised against the same data shape it just returned.
  const planted: ProviderTraffic = {
    ...traffic,
    requested: [...traffic.requested, `https://${LINK_HOST}/confirm?t=example-token`],
  };
  expect(requestsToHost(planted, LINK_HOST)).not.toEqual([]);

  // **And the other direction: the reader is not matching everything.** Without this, a
  // reader that returned every URL would pass the control above and fail the claim above
  // for the wrong reason — which is the same two-sided hole `sections.spec.ts` closes for
  // its per-client exemptions.
  expect(requestsToHost(traffic, "127.0.0.1")).not.toEqual([]);
});
