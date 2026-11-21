/**
 * Reference URL spellings and the home page's article links.
 *
 * The dated Temp Mail reference writes most informational routes with an `/en/` prefix and the
 * blog with a trailing slash. Those spellings used to answer HTTP 200 while rendering the home
 * product, because an unknown path falls through to `<App />`. This file holds down the fix at
 * two viewports and checks that each alias serves the **same** original SpectreMail article as its
 * bare canonical path. It also requires the home page's article region to hold six real anchors
 * whose hrefs resolve to routes this build actually serves.
 *
 * @module
 */

import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES } from "../src/public-routes";

/** Every reference spelling, paired with the canonical route it must resolve to. */
const ALIASES = PUBLIC_ROUTES.flatMap((route) =>
  (route.aliases ?? []).map((alias) => ({ alias, canonical: route.path, title: route.title })),
);

/** The desktop baseline and one mobile width from the reference capture set. */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test("all seven reference spellings are accounted for", () => {
  expect(ALIASES.map((entry) => entry.alias).sort()).toEqual(
    [
      "/en/change",
      "/en/faq",
      "/en/api",
      "/en/10minutemail",
      "/en/email-generator",
      "/en/contact",
      "/blog/",
    ].sort(),
  );
});

for (const view of VIEWPORTS) {
  for (const { alias, canonical, title } of ALIASES) {
    test(`${alias} renders the ${canonical} article, not the product, at ${view.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: view.width, height: view.height });

      const response = await page.goto(alias);
      expect(response?.status(), `${alias} was not served`).toBe(200);

      // The article is mounted: its H1 names the route and the article region is present.
      await expect(page.locator(".public-route")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

      // The home product is not: no address field and no hero panel.
      await expect(page.locator('[data-testid="address"]')).toHaveCount(0);
      await expect(page.locator(".hero__panel")).toHaveCount(0);
    });
  }
}

test("each alias serves byte-identical article copy to its canonical path", async ({ page }) => {
  for (const { alias, canonical } of ALIASES) {
    await page.goto(canonical);
    const canonicalCopy = await page.locator(".public-route").innerHTML();
    await page.goto(alias);
    const aliasCopy = await page.locator(".public-route").innerHTML();
    expect(aliasCopy, `${alias} did not render the same article as ${canonical}`).toBe(
      canonicalCopy,
    );
  }
});

test("the articles region holds six real links to served routes", async ({ page }) => {
  await page.goto("/");
  const anchors = page.locator('[data-region="articles"] li a');
  expect(await anchors.count(), "the reference has six article links").toBe(6);

  const links = await anchors.evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: node.getAttribute("href"),
      text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
      isAnchor: node instanceof HTMLAnchorElement,
    })),
  );

  const canonical = new Set(PUBLIC_ROUTES.map((route) => route.path));
  for (const link of links) {
    expect(link.isAnchor, `${link.text} is not an anchor`).toBe(true);
    expect(link.text.length, "an article link has non-empty text").toBeGreaterThan(0);
    expect(
      link.href !== null && canonical.has(link.href),
      `${link.text} points at an unserved route: ${String(link.href)}`,
    ).toBe(true);

    // Resolvable in the browser too: navigating the href mounts the article, not the product.
    await page.goto(link.href as string);
    await expect(page.locator(".public-route")).toHaveCount(1);
    await expect(page.locator('[data-testid="address"]')).toHaveCount(0);
  }
});
