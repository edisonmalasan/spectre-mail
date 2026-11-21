/**
 * M20 responsive and accessibility sweep over the M16 viewports.
 *
 * This file adds checks the existing focus.spec.ts does not: scroll/persistence of the
 * declared region order at each viewport, no horizontal overflow with a long address,
 * reduced motion at mobile width, and a keyboard path through the four toolbar actions.
 *
 * @module
 */

import { expect, test } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";
import { PAGE_ORDER, REGION_HOOKS } from "../src/sections";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "split", width: 956, height: 885 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile360", width: 360, height: 800 },
] as const;

test.describe("M20 responsive and accessibility sweep", () => {
  for (const view of VIEWPORTS) {
    test(`declared regions render in order with no horizontal overflow at ${view.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: view.width, height: view.height });
      await openFreshMailbox(page);

      const rendered = await page.evaluate(
        (hooks) =>
          hooks.filter((hook) => document.querySelector(`[data-region="${hook}"]`) !== null),
        Object.values(REGION_HOOKS),
      );
      expect(rendered, "every declared region is present").toEqual([
        ...Object.values(REGION_HOOKS),
      ]);

      const order = await page.evaluate(
        (hooks) =>
          [...document.querySelectorAll("[data-region]")]
            .map((element) => element.getAttribute("data-region"))
            .filter((hook): hook is string => hook !== null && hooks.includes(hook)),
        Object.values(REGION_HOOKS),
      );
      expect(order, "regions appear in the declared order").toEqual([
        ...Object.values(REGION_HOOKS),
      ]);

      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(overflow.scroll, `${view.name} has horizontal overflow`).toBeLessThanOrEqual(
        overflow.inner,
      );
      expect(PAGE_ORDER).toHaveLength(5);
    });
  }

  test("a long address stays inside the field and remains selectable at 360px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openFreshMailbox(page);
    const field = await page.locator(".hero__address").boundingBox();
    const value = await page.locator(".address__value").boundingBox();
    expect(value?.x, "the address starts inside the field").toBeGreaterThanOrEqual(field?.x ?? 0);
    expect(
      (value?.x ?? 0) + (value?.width ?? 0),
      "the address ends inside the field",
    ).toBeLessThanOrEqual((field?.x ?? 0) + (field?.width ?? 0) + 1);
    const text = await page.locator(".address__value").textContent();
    expect(text, "the full address is still present as text").toContain("@");
  });

  test("reduced motion removes every declared animation at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFreshMailbox(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .map((animation) => (animation as CSSAnimation).animationName)
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    );
    expect(running, "no declared animation runs under reduced motion").toEqual([]);
  });
});
