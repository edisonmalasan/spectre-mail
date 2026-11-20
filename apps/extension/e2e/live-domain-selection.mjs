/**
 * Live extension domain-selection probe — opt-in, not a suite.
 *
 * This is a measurement instrument, not a test: it creates a REAL mailbox on a REAL
 * provider with no route interception. It is quarantined for the same reason the other
 * live probes are — a test that contacted a third party on every CI run would rate-limit
 * the provider and make the suite's result depend on an external service.
 *
 * ## What it verifies
 *
 * The GOAL's Scenario D: open Change-like domain selection, pick a domain the provider
 * actually reported, create a mailbox, and confirm (a) the created address ends with
 * exactly that domain and (b) the requests went to the provider that owns the domain —
 * not to a fallback. A recorded response cannot answer either question: the domain list
 * and the account creation both have to be the provider's own answers.
 *
 * Run with:  node apps/extension/e2e/live-domain-selection.mjs
 * Exits 0 on success, 1 on a failed assertion or a provider failure.
 *
 * @module
 */

import { chromium } from "@playwright/test";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const RESULTS = join(HERE, "..", "test-results");
mkdirSync(RESULTS, { recursive: true });
const PROFILE = join(RESULTS, `live-domain-profile-${process.pid}`);

// A .mjs cannot import extensionFlags() from the TypeScript config, so the two flags
// are spelled here exactly as extensionFlags() writes them. The boundary suite checks
// both spellings against that helper; a divergence fails the build rather than silently
// loading no extension (Chromium reports no error when it loads nothing).
const LOAD_FLAGS = [`--load-extension=${DIST}`, `--disable-extensions-except=${DIST}`];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function hasPicker() {
  return readdirSync(DIST, { recursive: true })
    .filter((entry) => statSync(join(DIST, entry)).isFile())
    .some((entry) => readFileSync(join(DIST, entry), "utf8").includes("Choose a domain"));
}

const websiteCorsMode = process.argv.includes("--website-cors");
if (websiteCorsMode) {
  // A second subject of the same instrument: the website's origin has no host
  // permissions, so a provider that works in the extension may still be blocked here.
  // This phase runs BEFORE any extension context is opened, in a plain browser.
  const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));
  const { createServer } = await import("node:http");
  const server = createServer((request, response) => {
    const name = (request.url || "/").split("?")[0];
    const file = join(WEB_DIST, name === "/" ? "index.html" : name);
    if (!file.startsWith(WEB_DIST) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const ext = file.slice(file.lastIndexOf("."));
    const mime =
      { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] ||
      "application/octet-stream";
    response.writeHead(200, { "Content-Type": mime });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 400));
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    const observed = await page.evaluate(async () => {
      const base = "https://api.mail.tm";
      const out = { origin: location.origin, operations: {} };
      async function call(name, path, init) {
        try {
          const response = await fetch(base + path, { mode: "cors", ...init });
          out.operations[name] = {
            ok: response.ok,
            status: response.status,
            accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
            body: (await response.text()).slice(0, 180),
          };
        } catch (error) {
          out.operations[name] = { failed: String(error) };
        }
      }
      await call("domains", "/domains", { method: "GET" });
      const address = `probe${Date.now()}@euploading.com`;
      const password = `Pw${Date.now()}x`;
      for (const [name, path] of [
        ["accounts", "/accounts"],
        ["token", "/token"],
      ]) {
        await call(name, path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, password }),
        });
      }
      await call("messages", "/messages", { method: "GET" });
      return out;
    });
    console.log(JSON.stringify({ observed, consoleErrors }, null, 2));
    const blocked = Object.values(observed.operations).every((op) => op.failed !== undefined);
    console.log(
      blocked
        ? "Mail.tm is CORS-blocked from the website origin; it must stay disabled there."
        : "A Mail.tm call succeeded from the website origin — reassess the website provider list.",
    );
    if (!blocked) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(process.exitCode ?? 0);
}

const context = await chromium.launchPersistentContext(PROFILE, {
  channel: "chromium",
  args: LOAD_FLAGS,
});

const requests = [];
context.on("request", (request) => {
  const url = request.url();
  if (url.includes("api.mail.tm") || url.includes("api.guerrillamail.com")) {
    requests.push(`${request.method()} ${new URL(url).origin}${new URL(url).pathname}`);
  }
});

try {
  if (!existsSync(join(DIST, "popup.html"))) throw new Error("build the extension first");
  if (!hasPicker()) throw new Error("dist has no domain picker — rebuild the extension");

  let extensionId = null;
  for (let attempt = 0; attempt < 40 && extensionId === null; attempt++) {
    const workers = context.serviceWorkers();
    if (workers.length > 0) extensionId = new URL(workers[0].url()).host;
    else await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (extensionId === null) throw new Error("the extension worker never registered");

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: "domcontentloaded",
  });

  const choose = page.getByRole("button", { name: "Choose a domain" });
  await choose.waitFor({ timeout: 30_000 });
  await choose.click();
  const options = page.locator(".popup__domains button");
  const count = await options.count();
  if (count === 0) throw new Error("the live provider reported no usable domain");

  const chosen = (await options.first().textContent()).trim();
  await options.first().click();
  await page.locator(".popup__address").waitFor({ timeout: 30_000 });
  const address = (await page.locator(".popup__address").textContent()).trim();

  const domain = chosen.replace(/^@/, "");
  if (!address.endsWith(`@${domain}`)) {
    fail(`created address ${address} does not use the chosen domain ${domain}`);
  }
  if (!requests.some((entry) => entry.includes("GET https://api.mail.tm/domains"))) {
    fail("the popup did not fetch the live domain list from Mail.tm");
  }
  if (!requests.some((entry) => entry.includes("POST https://api.mail.tm/accounts"))) {
    fail("the chosen domain did not create an account on Mail.tm");
  }
  if (requests.some((entry) => entry.includes("guerrillamail"))) {
    fail("a Mail.tm domain was routed to a different provider");
  }

  await page.screenshot({ path: join(RESULTS, "live-domain-selection.png") });
  console.log(JSON.stringify({ chosen: `@${domain}`, address, requests }, null, 2));
  if (process.exitCode === 1) console.error("Live domain-selection verification FAILED");
  else console.log("Live domain-selection verification PASSED");
} catch (error) {
  fail(String(error));
} finally {
  await context.close();
}
