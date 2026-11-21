/**
 * Browser evidence for the public informational routes added after M17.
 *
 * Each route is a real path, not a decorative link: the served page renders an article with its
 * own accessible name and original copy, and the shared footer links only to routes this build
 * actually has. The home page still renders the working product.
 *
 * @module
 */

import { expect, test } from "@playwright/test";

import { SITE_ORIGIN } from "../playwright.config";
import { PUBLIC_ROUTES } from "../src/public-routes";

test("every public route renders its own article in the shared shell", async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} was not served`).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
    await expect(page.locator(".public-route__intro")).toHaveText(route.intro);
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const headings = await page.locator(".public-route__section h2").allTextContents();
    expect(headings, `${route.path} lost a section`).toEqual(route.sections.map((s) => s.heading));
    // No route renders the working product's address: reading the FAQ must not create a mailbox.
    await expect(page.locator('[data-testid="address"]')).toHaveCount(0);
  }
});

test("the footer links only to routes this build serves", async ({ page }) => {
  await page.goto("/");
  const links = await page
    .locator(".page-footer__nav a")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")));
  // /change is a toolbar action in the product, not a footer navigation item — the reference's
  // footer does not list it. Every other route must be reachable from the shared footer.
  const expected = PUBLIC_ROUTES.filter((route) => route.path !== "/change").map((r) => r.path);
  expect([...links].sort()).toEqual([...expected].sort());
  for (const href of links) {
    const response = await page.request.get(`${SITE_ORIGIN}${href}`);
    expect(response.status(), `${href} is a dead footer link`).toBe(200);
  }
});

test("the home page still renders the working product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your Temporary Email Address" })).toBeVisible();
  await expect(page.locator(".hero__panel")).toBeVisible();
  await expect(page.locator(".public-route")).toHaveCount(0);
});
