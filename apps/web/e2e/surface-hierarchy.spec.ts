/**
 * The page's hierarchy, read from the built page: what a region's name is, what the
 * datum inside it is, and which control completes the page's own job.
 *
 * ## What this file is the only instrument for
 *
 * `surface-hierarchy` declared a ninth type role — `region-label` — and applied it to
 * **every region name on the page**. Nothing before this file read a region name's
 * resolved type. `sections.spec.ts` reads the *order* of the regions and the accessible
 * name each one carries; `design-record.test.ts` holds `DESIGN.md`'s frontmatter to
 * `tokens.ts`. Neither asks what a heading on the built page actually resolves to, so a
 * stylesheet that set every region name at 22 px would have left every gate green.
 *
 * **And the three other claims here are the ones a stylesheet cannot make.** An address
 * that breaks after the `@` is a property of the *rendered line*, not of a `<wbr>` in the
 * markup: the element carries one whether or not the line ever wraps there. A row that
 * takes the width of its list is a measured width, and the measure it was fighting is a
 * `max-width` on `li`. And the accent's move from `Replace address` to `Copy address` is
 * a resolved background colour, which is the one thing a class name does not decide.
 *
 * ## Why every value is read from the cascade
 *
 * Each expectation is computed from the token's **authored value as the browser resolved
 * it** — `--type-xs`, `--leading-normal`, `--tracking-wide`, `--ink-muted`, `--accent` —
 * rather than from a number typed here. A literal `12px` in this file would pass after
 * the role's size changed, which is the defect a token layer exists to prevent arriving
 * in the instrument that is supposed to catch it.
 *
 * **The colour is asserted in both directions.** A heading must resolve to the ink its
 * region kind declares *and* not to the other one, because an ordinary region and a
 * failure region differ by exactly one rule and a single equality would pass on a page
 * where both rules had been deleted in favour of the body ink.
 *
 * ## What it does not establish
 *
 * - **Nothing about how any of it looks.** No assertion here reads a rendered pixel's
 *   colour or position. A resolved `font-size` is not a judgement about rank, and the
 *   question the change exists to answer — whether the datum now outranks its region's
 *   name — is answered by the numbers and judged by a person.
 * - **Nothing about a width above the one viewport named.** The address case reads
 *   390 px, the row case 1440 px, and no case claims what happens between them.
 * - **Nothing about a provider.** Every response is a recorded one, served by
 *   `open-mailbox.ts`, and the corpus answers every creation with the one address it
 *   recorded. So no case here can show that a replacement produces a *different* address:
 *   what it shows is that pressing the control reaches the provider, which is the part a
 *   role change could break and the part the fixtures can answer.
 */

import { expect, test } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";
import { declared, pxOf, rgbOf } from "./resolved-tokens";

/**
 * The five regions the page declares, and the heading each is named by.
 *
 * **`product` is named by a heading inside it rather than by the region's own label.**
 * The product region is labelled by `#product-heading`, which is the wordmark's `h1` —
 * the page's display step, and deliberately not a region name. So the heading read for
 * that region is the address's, which is one of the product's own regions and takes the
 * same rule as the other four. Reading the `h1` here would assert that the wordmark is
 * quiet, which is the opposite of what the page means.
 */
const REGION_HEADINGS = [
  ["product", "#address-heading"],
  ["steps", "#steps-heading"],
  ["reasons", "#reasons-heading"],
  ["extension", "#extension-heading"],
  ["footer", "#limits-heading"],
] as const;

/**
 * The readers live in `resolved-tokens.ts`, because `mailbox-history.spec.ts` holds a
 * failure region to the same ink and a second copy of "read a token" would be two
 * spellings of one thing.
 */

test.describe("the page's hierarchy", () => {
  test("sets every region's name at the label step, in the ink its kind declares", async ({
    page,
  }) => {
    await openFreshMailbox(page);

    const rootPx = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    const size = pxOf(await declared(page, "--type-xs"), rootPx);
    const leading = Number.parseFloat(await declared(page, "--leading-normal"));
    const tracking = Number.parseFloat(await declared(page, "--tracking-wide"));
    const weight = await declared(page, "--weight-medium");
    const muted = rgbOf(await declared(page, "--ink-muted"));

    for (const [region, selector] of REGION_HEADINGS) {
      const heading = page.locator(selector);
      await expect(heading, `${region}: ${selector} is not on the page`).toHaveCount(1);

      // **The precondition, and the half a selector can get wrong.** A heading read from
      // outside the region it is supposed to name would satisfy every value below while
      // proving nothing about that region — and `#address-heading` is chosen precisely
      // because the product's own label is not a region name.
      expect(
        await heading.evaluate(
          (element, name) => element.closest(`[data-region="${name}"]`) !== null,
          region,
        ),
        `${region}: ${selector} is not inside the region it is supposed to name`,
      ).toBe(true);

      const style = await heading.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
          textTransform: computed.textTransform,
          color: computed.color,
        };
      });

      expect(style.fontSize, `${region}: the name is not at --type-xs`).toBe(`${size}px`);
      expect(style.fontWeight, `${region}: the name is not at --weight-medium`).toBe(weight);
      expect(style.lineHeight, `${region}: the name is not at --leading-normal`).toBe(
        `${size * leading}px`,
      );
      expect(style.letterSpacing, `${region}: the name is not at --tracking-wide`).toBe(
        `${size * tracking}px`,
      );

      // **`none` and not `uppercase`.** Measured on 2026-10-29: Chromium's computed
      // accessible name follows the rendered transform, so an uppercased heading is named
      // `READY` in the accessibility tree while its `textContent` stays `Ready`. A role
      // that transformed its text would make every region's name disagree with the
      // string `sections.spec.ts` reads from the same element.
      expect(style.textTransform, `${region}: the name is transformed`).toBe("none");
      expect(style.color, `${region}: the name is not in --ink-muted`).toBe(muted);
    }
  });

  test("makes the address the largest datum, and breaks it after the @ when it cannot fit", async ({
    page,
  }) => {
    await openFreshMailbox(page);

    const address = page.locator(".address__value");
    const addressText = (await address.textContent())?.trim() ?? "";
    expect(addressText, "the page is showing no address").toContain("@");

    const rootPx = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    const size = pxOf(await declared(page, "--type-2xl"), rootPx);

    const reading = await address.evaluate((element) => {
      const computed = getComputedStyle(element);
      const container = element.parentElement;
      if (container === null) throw new Error("the address has no container");
      return {
        fontSize: computed.fontSize,
        display: computed.display,
        width: element.getBoundingClientRect().width,
        containerWidth: container.getBoundingClientRect().width,
        text: element.textContent ?? "",
        nodes: [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? ""),
      };
    });

    expect(reading.fontSize, "the address is not at --type-2xl").toBe(`${size}px`);
    expect(reading.display, "the address is not a block, so its line box is its string").toBe(
      "block",
    );
    expect(reading.width, "the address does not fill its container").toBeCloseTo(
      reading.containerWidth,
      1,
    );

    // **The mechanism, named.** The `@` ends one text node and the domain begins the next,
    // so the break opportunity is the `<wbr>` between them and nothing else. A zero-width
    // space would satisfy a line-box reading just as well and would enter the copied
    // value, which is why its absence is asserted rather than assumed.
    expect(reading.nodes, "the address is not split into two text nodes at the @").toHaveLength(2);
    expect(reading.text, "the element's text is not the address").toBe(addressText);
    expect(reading.text.includes("\u200b"), "a zero-width space is in the address").toBe(false);

    // **The rendered line, at the narrowest viewport the page is laid out for.**
    await page.setViewportSize({ width: 390, height: 844 });

    const line = await address.evaluate((element) => {
      const texts = [...element.childNodes].filter(
        (node): node is Text => node.nodeType === Node.TEXT_NODE,
      );
      const local = texts[0];
      const domain = texts[1];
      if (local === undefined || domain === undefined) {
        throw new Error("the address is not two text nodes");
      }
      const rectOf = (node: Text, offset: number) => {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        const rect = range.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      };
      const at = (local.textContent ?? "").lastIndexOf("@");
      return {
        localText: local.textContent ?? "",
        domainText: domain.textContent ?? "",
        at: rectOf(local, at),
        lastBefore: rectOf(local, at - 1),
        firstAfter: rectOf(domain, 0),
      };
    });

    expect(line.localText, "the first text node does not end at the @").toMatch(/@$/);
    expect(line.localText + line.domainText, "the two text nodes are not the address").toBe(
      addressText,
    );

    // **The break, and where it is.** The character after the `@` must sit on a lower line
    // than the `@` itself. Equal tops mean the address fitted on one line at this width,
    // and this assertion is the one that would then be reporting the truth.
    expect(
      line.firstAfter.top,
      `at 390 px the domain did not wrap after the @: ${addressText}`,
    ).toBeGreaterThan(line.at.top + 1);
    expect(line.lastBefore.top, "the @ is not on the first line").toBe(line.at.top);
  });

  test("gives the accent to the control that completes the page's job", async ({ page }) => {
    const traffic = await openFreshMailbox(page);

    const accent = rgbOf(await declared(page, "--accent"));
    const copy = page.getByRole("button", { name: "Copy address" });
    const replace = page.getByRole("button", { name: "Replace address" });

    await expect(copy).toBeVisible();
    await expect(replace).toBeVisible();

    const background = (locator: typeof copy): Promise<string> =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);

    expect(await background(copy), "the primary action does not carry --accent").toBe(accent);
    expect(await background(replace), "the replace control still carries --accent").not.toBe(
      accent,
    );

    /**
     * **The half a promotion can break without renaming anything.**
     *
     * `Replace address` keeps its name and its effect: pressing it asks the provider for a
     * different address. A control wired to the copy path, or one that had merely been
     * re-labelled, would satisfy both colour assertions above and fail here.
     *
     * **The observable is the request, not the address string, and the corpus is why.** The
     * recorded provider answers every creation with the one address it recorded, so pressing
     * `Replace address` produces a *new* mailbox carrying the *same* text — an assertion that
     * the text changed would be asserting something the fixtures cannot produce, and it would
     * fail on a page that had done exactly the right thing. What separates *replaced* from
     * *copied* is that a replacement reaches the provider at all.
     */
    const creationsBefore = traffic.served.filter((url) =>
      url.includes("f=get_email_address"),
    ).length;
    await replace.click();
    await expect
      .poll(() => traffic.served.filter((url) => url.includes("f=get_email_address")).length, {
        message: "Replace address asked the provider for no new address",
      })
      .toBe(creationsBefore + 1);

    // **And nothing was reached that the suite has no recorded answer for**, which is the
    // other way a promoted control can go wrong: a copy that fell through to a network path
    // would appear here rather than in the count above.
    expect(traffic.denied, "the page reached an origin with no recorded response").toEqual([]);
  });

  test("gives a mail row the width of its list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFreshMailbox(page);

    const row = page.locator(".inbox-row").first();
    await expect(row).toBeVisible();

    const reading = await row.evaluate((element) => {
      const item = element.closest("li");
      const list = element.closest("ul");
      if (item === null || list === null) throw new Error("the row is not in a list");
      return {
        row: element.getBoundingClientRect().width,
        item: item.getBoundingClientRect().width,
        list: list.getBoundingClientRect().width,
        columns: getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
      };
    });

    // **Two comparisons rather than one**, because the measure was on `li` and the row is
    // the button inside it: a row that filled its item while the item stopped short of the
    // list would pass a single equality against the wrong element.
    expect(reading.item, "the row's item stops short of the list").toBeCloseTo(reading.list, 1);
    expect(reading.row, "the row stops short of its item").toBeCloseTo(reading.item, 1);
    expect(reading.columns, "the row is not the two-column grid it declares").toBe(2);
  });
});
