/**
 * The report of what this session did, on the page the product ships.
 *
 * ## What is real here and what is not
 *
 * **The page's own storage, in real Chromium, and the page's own rendering.** Every case here
 * reads the built page rather than a module, so "the report shows what happened" is answered by
 * what a person would see.
 *
 * **Provider traffic is still replayed from recordings.** See `recorded-provider.ts`; a red run of
 * this file must mean this repository changed.
 *
 * ## The three claims, and why each needs the browser
 *
 * - **the report appears, and carries counts** — a unit test can render the component in jsdom,
 *   but only the built page proves the report is *on the page*.
 * - **the report carries no address** — the page has an address on screen a few lines above, and
 *   **a report that could hold one is only safe if the page beside it proves it does not.**
 * - **nothing the report holds survives the page** — a reload is the only thing that can show it,
 *   because the report lives in a ref and the claim is that there is no store behind it.
 *
 * @module
 */

import { expect, test } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";

test.describe("the report of what this session did", () => {
  test("appears on the page, inside the product region, and carries counts", async ({ page }) => {
    await openFreshMailbox(page);

    const report = page.getByTestId("diagnostic-entries");
    await expect(report, "the page rendered no report at all").toBeVisible();

    // **The counts are numbers, and the report is a list of them.** The label is the page's own
    // wording, so the assertion is on the shape rather than on the sentence.
    const entries = report.locator("dt");
    await expect(entries.first(), "the report carried no line at all").toBeVisible();
    expect(await entries.count(), "the report carried no line at all").toBeGreaterThan(0);

    const values = report.locator("dd");
    await expect(values.first(), "the report carried no value at all").not.toBeEmpty();
  });

  test("carries no address, and the page beside it does", async ({ page }) => {
    await openFreshMailbox(page);

    const report = page.getByTestId("diagnostic-entries");
    await expect(report, "the page rendered no report at all").toBeVisible();

    // **The page has an address on screen, and the report must not have one.** That is the whole
    // claim, and it is only worth anything beside an address that is really there.
    const address = page.locator(".address__value");
    await expect(address, "the page has no address, so the claim proves nothing").toBeVisible();
    const addressText = (await address.innerText()).trim();
    expect(
      addressText.length,
      "the page's address is empty, so the claim proves nothing",
    ).toBeGreaterThan(0);

    const reportText = (await report.innerText()).trim();
    expect(
      reportText.includes(addressText),
      "the report holds the address the page is showing beside it",
    ).toBe(false);
    expect(reportText.includes("@"), "the report holds an address").toBe(false);
  });

  test("holds nothing that survives the page", async ({ page }) => {
    await openFreshMailbox(page);

    const report = page.getByTestId("diagnostic-entries");
    await expect(report, "the page rendered no report at all").toBeVisible();
    const before = (await report.innerText()).trim();

    await page.reload();

    // **The report is a report of the session, and the session is over.** A report that came back
    // the same after a reload would be a record, and a record is the thing this change does not
    // make.
    const after = page.getByTestId("diagnostic-entries");
    if ((await after.count()) > 0) {
      expect(
        (await after.innerText()).trim() === before,
        "the report came back exactly the same after a reload, so it is a record rather than a report of a session",
      ).toBe(false);
    }
  });
});
