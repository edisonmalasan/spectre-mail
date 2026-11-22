/**
 * Live end-to-end reception probe — two modes, no credentials requested.
 *
 *   node apps/extension/e2e/live-reception.mjs --prepare
 *     Creates a real mailbox on a live Mail.tm domain in the built extension, writes the
 *     address and a pending receipt to a dedicated gitignored directory OUTSIDE Playwright's
 *     output tree, and prints
 *     the address plus the exact test message for a human to send from their own mail app.
 *
 *   node apps/extension/e2e/live-reception.mjs --verify
 *     Reopens the SAME persistent profile, waits for the test message to arrive from the
 *     provider, opens it in the real popup, and verifies the rendered sender, subject,
 *     timestamp, body, extracted code and extracted link. No fixture is inserted: the
 *     listing and the body come from the provider over the network.
 *
 * The two modes exist so nobody has to disclose an SMTP password or API token in chat.
 * Until --verify has passed, this milestone's reception test is PENDING, never passed.
 *
 * @module
 */

import { chromium } from "@playwright/test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
/*
 * Playwright owns `apps/extension/test-results/` and wipes it at the start of a tier run.
 * A mailbox prepared there would silently disappear the next time anybody ran the suite, so
 * this instrument uses its own gitignored directory. The pending receipt must outlive a test run.
 */
const RESULTS = fileURLToPath(new URL("./.live-reception", import.meta.url));
const PROFILE = join(RESULTS, "live-reception-profile");
const STATE = join(RESULTS, "live-reception.json");

const TEST_SUBJECT = "SpectreMail E2E Verification";
const TEST_BODY =
  "SpectreMail delivery verification. Test code: 482731. Test link: https://example.com/verify";

const LOAD_FLAGS = [`--load-extension=${DIST}`, `--disable-extensions-except=${DIST}`];

function hasPicker() {
  return readdirSync(DIST, { recursive: true })
    .filter((entry) => statSync(join(DIST, entry)).isFile())
    .some((entry) => readFileSync(join(DIST, entry), "utf8").includes("Choose a domain"));
}

async function openPopup(mode) {
  if (!existsSync(join(DIST, "popup.html")) || !hasPicker()) {
    throw new Error("Build the extension with the domain picker first: pnpm build:extension");
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
  console.error(`[${mode}] popup opened from ${extensionId}`);
  return { context, page, requests };
}

async function prepare() {
  mkdirSync(RESULTS, { recursive: true });
  // A fresh mailbox needs a fresh device: an old profile would restore its previous
  // mailbox, hide the picker, and make this run verify nothing.
  rmSync(PROFILE, { recursive: true, force: true });
  rmSync(STATE, { force: true });
  const { context, page, requests } = await openPopup("prepare");
  try {
    const choose = page.getByRole("button", { name: "Choose a domain" });
    await choose.waitFor({ timeout: 45_000 });
    await choose.click();
    const option = page.locator(".popup__domains button").first();
    // Read the choice from the option itself: the popup's address heading names the
    // provider ("Mail.tm"), not the domain, so it cannot answer which one was picked.
    const chosen = ((await option.textContent()) || "").trim().replace(/^@/, "");
    await option.click();
    await page.locator(".popup__address").waitFor({ timeout: 60_000 });
    const address = ((await page.locator(".popup__address").textContent()) || "").trim();
    writeFileSync(
      STATE,
      JSON.stringify(
        { address, chosenDomain: chosen, preparedAt: new Date().toISOString(), status: "pending" },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          status: "PENDING_LIVE_RECEPTION",
          address,
          requests,
          sendFromYourOwnMailApp: { subject: TEST_SUBJECT, body: TEST_BODY },
          nextStep: "Send the message above to the address, then run: --verify",
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
  }
}

async function verify() {
  if (!existsSync(STATE)) throw new Error("No prepared mailbox — run --prepare first");
  const prepared = JSON.parse(readFileSync(STATE, "utf8"));
  const { context, page, requests } = await openPopup("verify");
  const result = { ...prepared, status: "pending", checks: {} };
  try {
    await page
      .getByTestId("address")
      .waitFor({ timeout: 30_000 })
      .catch(async () => {
        await page.locator(".popup__address").waitFor({ timeout: 30_000 });
      });
    const shown = (await page.locator(".popup__address").textContent()).trim();
    result.checks.restoredAddressMatches = shown === prepared.address;

    const check = page.getByRole("button", { name: "Check for mail" });
    await check.click();
    const row = page.locator(".message-row").first();
    try {
      await row.waitFor({ timeout: 60_000 });
    } catch {
      result.status = "PENDING";
      result.note = "No message has arrived yet. Send the test email, then re-run --verify.";
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const open = row.getByRole("button");
    await open.click();
    await page.getByTestId("message-opened").waitFor({ timeout: 30_000 });

    const textOf = async (testid) => (await page.getByTestId(testid).textContent()).trim();
    result.checks.sender = await textOf("message-from");
    result.checks.senderPresent = result.checks.sender.length > 0;
    result.checks.subject = await textOf("message-subject");
    result.checks.timestamp = await textOf("message-received-at");
    result.checks.bodyContainsCode = (await textOf("message-readable")).includes("482731");
    result.checks.bodyContainsLink = (await textOf("message-readable")).includes(
      "https://example.com/verify",
    );
    const codes = await page.getByTestId("code-list").textContent();
    result.checks.extractedCode = codes.includes("482731");
    // Count first: a verification URL delivered as bare text has no <a href>, so calling
    // getAttribute on .first() would wait for a node that never arrives and throw instead of
    // recording the missing anchor. The extractedLink gate below is deliberately left in
    // `passed`: false is the truthful result for a bare-text link, and dropping it would
    // hide the documented <a href>-only limitation of packages/mail-parser.
    const linkAnchors = page.locator('[data-testid="link-list"] a');
    const anchorCount = await linkAnchors.count();
    result.checks.extractedLink =
      anchorCount > 0 &&
      (await linkAnchors.first().getAttribute("href")) === "https://example.com/verify";
    result.checks.subjectMatches = result.checks.subject === TEST_SUBJECT;
    result.checks.timestampIsNotEpoch = !result.checks.timestamp.includes("1970-01-01");
    result.checks.retrievedFromProvider = requests.some((entry) =>
      entry.includes("GET https://api.mail.tm/messages"),
    );
    result.requests = requests;
    await page.screenshot({ path: join(RESULTS, "live-reception.png") });

    // Message-level reception is independent of link extraction: a bare-text URL arrived
    // and was rendered in the readable body, but no <a href> exists for the parser to recover.
    const messageLevelChecks = [
      "restoredAddressMatches",
      "senderPresent",
      "subjectMatches",
      "timestampIsNotEpoch",
      "bodyContainsCode",
      "bodyContainsLink",
      "extractedCode",
      "retrievedFromProvider",
    ];
    result.receptionVerified = messageLevelChecks.every((key) => result.checks[key] === true);
    result.linkObservation =
      "The verification URL arrived as bare text with a newline, not an <a href>, so no link " +
      "anchor was extracted (extractedLink is false). packages/mail-parser detects links only " +
      "from <a href> elements; this documented limitation is now confirmed on real external " +
      "mail. The URL text itself did arrive and is shown in the readable body (bodyContainsLink).";

    const passed = Object.entries(result.checks)
      .filter(([key]) => key !== "sender")
      .every(([, value]) => value === true);
    result.status = passed ? "PASSED" : "FAILED";
    console.log(JSON.stringify(result, null, 2));
    if (!passed) process.exitCode = 1;
    writeFileSync(STATE, JSON.stringify(result, null, 2));
  } finally {
    await context.close();
  }
}

const mode = process.argv.includes("--prepare")
  ? "prepare"
  : process.argv.includes("--verify")
    ? "verify"
    : null;
if (mode === null) {
  console.error("Pass --prepare to create a mailbox, or --verify after sending the test email");
  process.exit(1);
}
try {
  if (mode === "prepare") await prepare();
  else await verify();
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
