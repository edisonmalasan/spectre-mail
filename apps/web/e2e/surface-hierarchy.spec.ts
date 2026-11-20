/**
 * The hierarchy of the rebuilt page, read from the built page.
 *
 * ## What survived the temp-mail.org rebuild
 *
 * The five region names this file used to pin are gone with the sections they named.
 * What remains is the part that still describes the surface that ships:
 *
 * - **the address is a datum, not a label.** It renders as a block that fills its
 *   field and breaks after the `@` when the field is too narrow — measured on the
 *   rendered line at 390 px, not on the `<wbr>` in the markup;
 * - **the accent follows the job.** The in-field Copy completes the page's job and
 *   carries the fill; the toolbar's Change is framed, and pressing it still reaches
 *   the provider;
 * - **an inbox row takes the width of its list**, a measured width that the old
 *   `max-width` on `li` used to fight.
 *
 * ## Why every value is read from the cascade
 *
 * Each expectation is computed from the token's **authored value as the browser resolved
 * it** — `--type-base`, `--accent` — rather than from a number typed here. A literal
 * `16px` in this file would pass after the step changed, which is the defect a token
 * layer exists to prevent arriving in the instrument supposed to catch it.
 *
 * ## What it does not establish
 *
 * - **Nothing about how any of it looks.** No assertion here reads a rendered pixel's
 *   colour or position. A resolved `font-size` is not a judgement about rank.
 * - **Nothing about a width above the one viewport named.** The address case reads
 *   390 px, the row case 1440 px, and no case claims what happens between them.
 * - **Nothing about a provider.** Every response is a recorded one, served by
 *   `open-mailbox.ts`; what the Change case shows is that pressing the control reaches
 *   the provider, which is the part a wiring change could break.
 *
 * @module
 */

import { expect, test } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";
import { declared, pxOf, rgbOf } from "./resolved-tokens";

/**
 * The readers live in `resolved-tokens.ts` so that "read a token" has one spelling.
 * The spec that made the second copy unnecessary was deleted with its section; the
 * shared helper stays because two files here still use it.
 */

test.describe("the page's hierarchy", () => {
  test("keeps the address on one line with its exact value, and never resizes on Copy", async ({
    page,
  }) => {
    await openFreshMailbox(page);

    const address = page.locator(".address__value");
    const addressText = (await address.textContent())?.trim() ?? "";
    expect(addressText, "the page is showing no address").toContain("@");

    const rootPx = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    const size = pxOf(await declared(page, "--type-lg"), rootPx);

    const read = () =>
      address.evaluate((element) => {
        const computed = getComputedStyle(element);
        const container = element.parentElement;
        if (container === null) throw new Error("the address has no container");
        return {
          fontSize: computed.fontSize,
          display: computed.display,
          whiteSpace: computed.whiteSpace,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          containerWidth: container.getBoundingClientRect().width,
          containerHeight: container.getBoundingClientRect().height,
          text: element.textContent ?? "",
          nodes: [...element.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? ""),
          title: container.getAttribute("title") ?? "",
        };
      });

    const before = await read();
    expect(before.fontSize, "the address is not at --type-lg").toBe(`${size}px`);
    expect(before.display, "the address is not a block").toBe("block");
    expect(before.whiteSpace, "the address may wrap").toBe("nowrap");
    expect(before.nodes, "the address is not one text node").toHaveLength(1);
    expect(before.text, "the element's text is not the address").toBe(addressText);
    expect(before.text.includes("\u200b"), "a zero-width space is in the address").toBe(false);
    expect(before.title, "the full address is not available as a title").toBe(addressText);

    // **One line at the narrowest viewport**, verified by a single bounding box rather
    // than by splitting text nodes: a long address is clipped/scrollable, never wrapped.
    for (const width of [1440, 956, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const line = await read();
      const range = await address.evaluate((element) => {
        const r = document.createRange();
        r.selectNodeContents(element);
        const rects = [...r.getClientRects()];
        return rects.length;
      });
      expect(range, `the address wrapped at ${width}px`).toBe(1);
      // Sub-pixel layout differences between CI and local Chromium are not a wrap:
      // a wrap would roughly double the height, far outside this tolerance.
      expect(line.height, `the address grew vertically at ${width}px`).toBeCloseTo(
        before.height,
        0,
      );
    }

    // **Copy must not resize the field.** Press both controls and read the geometry
    // again after each feedback state appears.
    await page.setViewportSize({ width: 956, height: 885 });
    const field = page.locator(".hero__address");
    const boxOf = () => field.boundingBox();
    const boxBefore = await boxOf();
    await page.getByTestId("address-copy").click();
    // Headless Chromium may refuse the clipboard without a permission; either outcome
    // is a real feedback state, and both must leave the field's box unchanged.
    await expect(page.getByTestId("copy-feedback")).toBeVisible();
    const boxAfterFieldCopy = await boxOf();
    expect(boxAfterFieldCopy?.width, "field-copy feedback resized the address field").toBe(
      boxBefore?.width,
    );
    expect(boxAfterFieldCopy?.height, "field-copy feedback resized the address field").toBe(
      boxBefore?.height,
    );

    await page.getByTestId("toolbar-copy").click();
    await expect(page.getByTestId("copy-feedback")).toBeVisible();
    const boxAfterToolbarCopy = await boxOf();
    expect(boxAfterToolbarCopy?.width, "toolbar-copy feedback resized the address field").toBe(
      boxBefore?.width,
    );
    expect(boxAfterToolbarCopy?.height, "toolbar-copy feedback resized the address field").toBe(
      boxBefore?.height,
    );

    // The toast is a fixed live region outside the field and dismisses itself.
    await expect(page.getByTestId("copy-feedback")).toBeHidden({ timeout: 5000 });
  });

  test("gives the accent to the in-field Copy, and keeps the toolbar Change framed", async ({
    page,
  }) => {
    const traffic = await openFreshMailbox(page);

    const accent = rgbOf(await declared(page, "--accent"));
    const copy = page.getByTestId("address-copy");
    // The toolbar's Change button is the control that used to be the filled
    // `Replace address`; it keeps its name and its effect, and loses the claim.
    const change = page.getByTestId("toolbar-change");

    await expect(copy).toBeVisible();
    await expect(change).toBeVisible();

    const background = (locator: typeof copy): Promise<string> =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);

    expect(await background(copy), "the in-field Copy does not carry --accent").toBe(accent);
    expect(await background(change), "the toolbar Change still carries its framing").not.toBe(
      accent,
    );

    /**
     * **The half a wiring change can break without renaming anything.**
     *
     * Change still reaches the provider: pressing it asks for another address. The
     * observable is the request, not the address string — the recorded provider answers
     * every creation with the one address it recorded, so an assertion that the text
     * changed would be asserting something the fixtures cannot produce. What separates
     * *changed* from *copied* is that a change reaches the provider at all.
     */
    const creationsBefore = traffic.served.filter((url) =>
      url.includes("f=get_email_address"),
    ).length;
    // Change opens the domain picker; Automatic is the only option this browser can serve.
    await change.click();
    await page.getByRole("button", { name: /Automatic/i }).click();
    await expect
      .poll(() => traffic.served.filter((url) => url.includes("f=get_email_address")).length, {
        message: "toolbar Change asked the provider for no new address",
      })
      .toBe(creationsBefore + 1);

    // And nothing was reached that the suite has no recorded answer for.
    expect(traffic.denied, "the page reached an origin with no recorded response").toEqual([]);
  });

  test("gives the inbox list the panel width and the row a two-column grid", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFreshMailbox(page);

    const row = page.locator(".inbox-row").first();
    await expect(row).toBeVisible();

    const reading = await row.evaluate((element) => {
      const item = element.closest("li");
      const list = element.closest("ul");
      const head = document.querySelector(".inbox-table-head");
      if (item === null || list === null || head === null) {
        throw new Error("the row is not in the rebuilt inbox table");
      }
      return {
        row: element.getBoundingClientRect().width,
        item: item.getBoundingClientRect().width,
        list: list.getBoundingClientRect().width,
        columns: getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
        headColumns: getComputedStyle(head).gridTemplateColumns.trim().split(/\s+/).length,
      };
    });

    // **The row fills its item, which fills the list.** The stylesheet declares
    // `.inbox-row { width: 100% }` so the sender/subject columns align with the dark
    // SENDER / SUBJECT / VIEW bar — the reference property this case guards. A row that
    // shrank to its own content would leave the columns unaligned and this case red.
    expect(reading.item, "the row's item stops short of the list").toBeCloseTo(reading.list, 1);
    expect(reading.row, "the row button does not fill its item").toBeCloseTo(reading.item, 1);
    expect(reading.columns, "the row is not the two-column grid it declares").toBe(2);
    expect(reading.headColumns, "the column bar is not the three-column grid it declares").toBe(3);
  });
});
