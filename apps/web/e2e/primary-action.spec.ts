/**
 * The one filled control on the page, in every state it has.
 *
 * ## What this is the only instrument for
 *
 * `Replace address` is the website's **primary action** and the only control that takes the
 * accent fill. Until this file, nothing in the repository read that control's colour in a
 * state other than rest — and the gap was not theoretical.
 *
 * **The hover state painted `--ink-on-accent` on `--surface-sunken`**: white on near-white,
 * measured with `packages/ui`'s own contrast function at **1.22:1 in the light scheme and
 * 1.04:1 in the dark one**. A label at 1.22:1 is not dim, it is gone — on the control the
 * page offers as the way forward, at the moment a person is about to press it. Every gate
 * in the repository was green.
 *
 * **Why no gate could have failed.** `pairs.test.ts` holds every pair *declared* in
 * `pairs.ts` to its threshold, and a hover pair was not declared there; the browser tier's
 * sweeps read the served stylesheet and the rest-state DOM. So the arithmetic that would
 * have said `1.22:1` was never asked to run, which is why the repair is this file rather
 * than only the two properties it asserts.
 *
 * ## Why the number is computed rather than written down
 *
 * The assertion calls `meets` and `contrastRatio` from `@spectre-mail/ui` — the same
 * functions `pairs.test.ts` uses — over the colours **Chromium resolved**, converted from
 * `rgb()` to the hex form those functions take. So the figure in a failure message is
 * WCAG's arithmetic over what the browser painted, not a value typed here, and a colour the
 * conversion cannot read throws rather than being compared as though it had been read.
 *
 * ## What it does not establish
 *
 * - **Nothing about how the control looks.** A ratio is not a judgement about emphasis;
 *   no assertion here reads a rendered pixel's colour or position.
 * - **Nothing about a state this page does not have.** The website's primary action has
 *   rest, hover and active, and **no disabled state** — so the label is checked where it
 *   can be reached and nowhere else. The extension's filled control has a `:disabled` state
 *   that `apps/extension/src/styles.css` paints; it is not driven here and not claimed.
 * - **Nothing about the provider.** Every response is a recorded one, served by
 *   `open-mailbox.ts`; only the mailbox's presence matters to this file.
 */

import { expect, test } from "@playwright/test";
import { BODY_TEXT, contrastRatio, meets } from "@spectre-mail/ui";

import { openFreshMailbox } from "./open-mailbox";

/** The filled control's accessible name, which is what a person reads on it. */
const PRIMARY_ACTION_NAME = "Replace address";

/** A foreground/background pair as the browser resolved it, still in `rgb()` form. */
interface ResolvedPair {
  readonly ink: string;
  readonly surface: string;
}

/**
 * `rgb(r, g, b)` — Chromium's computed form — to the `#rrggbb` a contrast function takes.
 *
 * **Throws rather than guessing.** `packages/ui`'s functions reject anything that is not
 * `#rgb` or `#rrggbb`, so an unreadable value already fails; doing it here names the value
 * and the reason in the same error instead of letting a parser upstream decide. A
 * conversion that quietly produced `#000000` from a value it did not understand would
 * report a ratio for a colour nothing painted.
 *
 * Alpha is deliberately **not** handled: every surface and ink in this palette is opaque,
 * and a translucent one would need compositing before any ratio meant anything. Should one
 * ever appear, this throws — which is the honest outcome, because the alternative is a
 * number computed against nothing.
 */
function hexOf(resolved: string): string {
  const parts = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/.exec(resolved.trim());
  if (parts === null) {
    throw new Error(`not an opaque rgb() colour, so it cannot be held to a ratio: ${resolved}`);
  }
  return `#${parts
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

test.describe("the primary action", () => {
  test("paints its label in a readable pair at rest, on hover and while pressed, in both schemes", async ({
    page,
  }) => {
    await openFreshMailbox(page);

    const primary = page.getByRole("button", { name: PRIMARY_ACTION_NAME });
    await expect(primary).toBeVisible();

    /**
     * The pair, read off the element rather than off the stylesheet.
     *
     * `getComputedStyle` returns the **used** colour, so a token resolved through a media
     * query, a later rule overriding an earlier one, and a shorthand resetting a
     * longhand are all already applied by the time this reads. That is the difference
     * between this instrument and a sweep of authored text.
     */
    const readPair = (): Promise<ResolvedPair> =>
      primary.evaluate((element) => {
        const style = getComputedStyle(element);
        return { ink: style.color, surface: style.backgroundColor };
      });

    for (const scheme of ["light", "dark"] as const) {
      // **Both schemes explicitly, including the one the context already defaults to.**
      // A reading taken under an implicit default is a reading that depends on the
      // machine's own preference, and this palette has two schemes that fail differently.
      await page.emulateMedia({ colorScheme: scheme });

      // **The pointer moves off the control before the rest reading**, because the
      // previous scheme left it hovering: a "rest" pair read under a hover is the
      // defect this file exists for, wearing its own instrument's clothes.
      await page.mouse.move(0, 0);
      const rest = await readPair();

      await primary.hover();

      // **The precondition, and the assertion most likely to be missing.** Every claim
      // below is about a hovered control, and a pointer that never moved would leave the
      // reading at rest — which passes, on a page where hovering does nothing at all.
      // So the surface must demonstrably change before anything is measured on it.
      await expect
        .poll(async () => (await readPair()).surface, {
          message: `${scheme}: hovering the primary action must repaint its fill`,
        })
        .not.toBe(rest.surface);

      const hovered = await readPair();

      /**
       * **The pressed state, and the half a keyboard user meets.**
       *
       * `:active` shares one rule with `:hover` in the repair, for a reason the stylesheet
       * states: an activation from the keyboard fires `:active` **without** `:hover`, so a
       * separate rule that set only the surface would put the label back on a near-white
       * background for exactly the person who cannot see a pointer.
       *
       * **`matches(":active")` is the precondition, not decoration.** The pressed pair
       * under the repair is the same pair as the hovered one, so without this a press that
       * never registered would leave this loop reading the hover twice and passing on a
       * page whose `:active` state is unreadable.
       */
      await page.mouse.down();
      await expect
        .poll(() => primary.evaluate((element) => element.matches(":active")), {
          message: `${scheme}: pressing the primary action must put it in the :active state`,
        })
        .toBe(true);
      const pressed = await readPair();

      // **Released off the control, so the press does not become a click.** A `mouseup`
      // on the button would activate it, and activating this one creates a second mailbox
      // — a side effect this case has no business causing, in either client.
      await page.mouse.move(0, 0);
      await page.mouse.up();

      for (const [state, pair] of [
        ["at rest", rest],
        ["hovered", hovered],
        ["pressed", pressed],
      ] as const) {
        expect(
          meets(hexOf(pair.ink), hexOf(pair.surface), BODY_TEXT),
          `${scheme} / ${state}: the label measures ${contrastRatio(
            hexOf(pair.ink),
            hexOf(pair.surface),
          ).toFixed(2)}:1 as ${pair.ink} on ${pair.surface}`,
        ).toBe(true);
      }
    }
  });
});
