/**
 * Browser-environment probes.
 *
 * The roadmap requires the same provider checks to be run from a normal web
 * page and from a Chrome extension context. This is the only place that
 * measures that, and it measures it in a real browser.
 *
 * Two rules encoded here:
 *  - a request blocked by CORS is `blocked`, which is NOT the same as the
 *    provider being broken;
 *  - the normal-page result and the extension result are always reported
 *    separately, never averaged into one verdict.
 */

import { createServer } from "node:http";
import { once } from "node:events";

import { failed, passed, unverified } from "../probe-runner.mjs";
import { buildExtensionFixture, toMatchPatterns } from "../browser/extension-fixture.mjs";

/**
 * Injected into every probed page. Returns serialisable evidence only.
 *
 * This must be a real function declaration, not a string: Playwright
 * serialises the function source and evaluates it in the page, so a function
 * built with `new Function` would be shipped as a factory and never invoked.
 * It must also not close over anything in this module.
 */
async function pageProbe(target) {
  const results = [];
  for (const req of target.requests) {
    const entry = { id: req.id, url: req.url, method: req.method || "GET" };
    try {
      const init = { method: req.method || "GET", headers: req.headers || {} };
      if (req.body) init.body = req.body;
      const response = await fetch(req.url, init);
      const text = await response.text();
      entry.outcome = "allowed";
      entry.status = response.status;
      entry.acao = response.headers.get("access-control-allow-origin");
      entry.bodyExcerpt = text.replace(/\s+/g, " ").slice(0, 200);
    } catch (error) {
      entry.outcome = "blocked";
      entry.error = String(error && error.message ? error.message : error);
    }
    results.push(entry);
  }
  return { origin: location.origin, results };
}

/** Tiny static server so the "normal page" runs on a real http origin. */
async function startPageServer() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>SpectreMail M0 spike page</title></head><body>Disposable spike page.</body></html>",
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    return { __error: error };
  }
}

async function resolveExtensionId(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const worker = context.serviceWorkers()[0];
    if (worker) return worker.url().split("/")[2];
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function buildRequests({ includePreflight }) {
  const requests = [
    { id: "mailtm-domains", url: "https://api.mail.tm/domains" },
    {
      id: "guerrilla-address",
      url: "https://api.guerrillamail.com/ajax.php?f=get_email_address&lang=en",
    },
  ];
  if (includePreflight) {
    requests.push({
      id: "mailtm-preflight-post",
      url: "https://api.mail.tm/accounts",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "not-an-email", password: "x" }),
    });
  }
  return requests;
}

function summarise(results, target) {
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  return {
    origin: target.origin,
    requests: results,
    blocked: results.filter((r) => r.outcome === "blocked").map((r) => r.id),
  };
}

/**
 * Empirically verify the host-permission match-pattern form.
 *
 * This is a silent-failure trap: a slash-less pattern such as
 * `https://api.mail.tm` is accepted into the manifest and then grants nothing,
 * so every cross-origin fetch fails opaquely. The extension would ship looking
 * correct and simply never be able to reach the provider. It is measured here
 * rather than asserted, because getting it wrong costs the whole extension.
 */
export async function runMatchPatternProbe(runner, { targetUrl, targetOrigin }) {
  await runner.probe(
    "browser.extension-host-permission-pattern",
    "Match-pattern form grants cross-origin access",
    async () => {
      const playwright = await import("playwright").catch((error) => ({ __error: error }));
      if (playwright.__error) {
        return unverified(
          `playwright is not installed (${playwright.__error.message})`,
        );
      }

      const results = {};
      for (const [label, pattern] of [
        ["withoutPath", targetOrigin],
        ["withWildcardPath", toMatchPatterns([targetOrigin])[0]],
      ]) {
        const fixture = await buildExtensionFixture({
          origins: [targetOrigin],
          version: label,
        });
        // Rewrite the manifest with the exact pattern under test.
        const manifest = { ...fixture.manifest, host_permissions: [pattern] };
        const { writeFile } = await import("node:fs/promises");
        await writeFile(
          `${fixture.dir}/manifest.json`,
          JSON.stringify(manifest, null, 2),
          "utf8",
        );

        let context;
        try {
          context = await playwright.chromium.launchPersistentContext("", {
            channel: "chromium",
            headless: true,
            args: [
              `--disable-extensions-except=${fixture.dir}`,
              `--load-extension=${fixture.dir}`,
            ],
          });
          let worker = context.serviceWorkers()[0];
          if (!worker) {
            await new Promise((resolve) => setTimeout(resolve, 2500));
            worker = context.serviceWorkers()[0];
          }
          if (!worker) {
            results[label] = "extension did not load";
            continue;
          }
          results[label] = await worker.evaluate(async (url) => {
            try {
              const response = await fetch(url);
              return `reachable (${response.status})`;
            } catch (error) {
              return `blocked (${error})`;
            }
          }, targetUrl);
        } catch (error) {
          results[label] = `launch failed: ${error.message}`;
        } finally {
          if (context) await context.close().catch(() => {});
        }
      }

      const withoutPathWorks = results.withoutPath?.startsWith("reachable");
      const withPathWorks = results.withWildcardPath?.startsWith("reachable");

      if (!withoutPathWorks && withPathWorks) {
        return passed(
          `"${targetOrigin}" grants NO access while "${toMatchPatterns([targetOrigin])[0]}" does — a slash-less host pattern is silently a no-op, so the extension must declare the wildcard path form`,
          results,
        );
      }
      if (withoutPathWorks && withPathWorks) {
        return passed(
          `both host-permission forms grant access; the wildcard path form is used anyway for clarity`,
          results,
        );
      }
      return failed(
        "neither host-permission form reached the provider, so the extension-context result cannot be trusted",
        results,
      );
    },
  );
}

export async function runBrowserProbes(runner, { targets, headless = true } = {}) {
  runner.section("Browser environments");

  const playwright = await loadPlaywright();
  if (playwright.__error) {
    const reason = `playwright is not installed (${playwright.__error.message})`;
    for (const [env, name] of [
      ["normal-web-page", "Normal web page"],
      ["extension-context", "Chromium extension context"],
    ]) {
      await runner.probe(
        `browser.${env}.mailtm`,
        `${name}: reach api.mail.tm`,
        async () => unverified(reason),
      );
      await runner.probe(
        `browser.${env}.guerrilla`,
        `${name}: reach api.guerrillamail.com`,
        async () => unverified(reason),
      );
    }
    return;
  }

  const origins = targets.map((t) => new URL(t.base).origin);
  const fixture = await buildExtensionFixture({
    origins,
    version: "normal+extension",
  });

  let context = null;
  let launchNote = null;
  const pageServer = await startPageServer();

  try {
    for (const headlessMode of headless ? [true, false] : [false]) {
      try {
        context = await playwright.chromium.launchPersistentContext(
          "", // temp user data dir
          {
            channel: "chromium",
            headless: headlessMode,
            args: [
              `--disable-extensions-except=${fixture.dir}`,
              `--load-extension=${fixture.dir}`,
            ],
          },
        );
        const id = await resolveExtensionId(context, 8000);
        if (id) {
          launchNote = `headless=${headlessMode}`;
          context.__extensionId = id;
          break;
        }
        launchNote = `headless=${headlessMode} loaded no service worker`;
        await context.close();
        context = null;
      } catch (error) {
        launchNote = `headless=${headlessMode} launch failed: ${error.message}`;
        context = null;
      }
    }

    if (!context) {
      for (const [env, name] of [
        ["normal-web-page", "Normal web page"],
        ["extension-context", "Chromium extension context"],
      ]) {
        await runner.probe(
          `browser.${env}.mailtm`,
          `${name}: reach api.mail.tm`,
          async () => unverified(`Chromium could not be launched — ${launchNote}`),
        );
        await runner.probe(
          `browser.${env}.guerrilla`,
          `${name}: reach api.guerrillamail.com`,
          async () => unverified(`Chromium could not be launched — ${launchNote}`),
        );
      }
      return;
    }

    const extensionId = context.__extensionId;
    const requests = buildRequests({ includePreflight: true });

    // ---- normal web page
    const page = await context.newPage();
    await page.goto(pageServer.url, { waitUntil: "domcontentloaded" });
    const normalResult = await page.evaluate(pageProbe, { requests });

    await runner.probe(
      "browser.normal-web-page.mailtm",
      "Normal web page: reach api.mail.tm",
      async () => {
        const entry = normalResult.results.find((r) => r.id === "mailtm-domains");
        if (!entry) return failed("no result recorded for api.mail.tm");
        if (entry.outcome === "blocked") {
          return failed(
            `browser blocked the request from ${normalResult.origin} (${entry.error}); this origin is not granted CORS by api.mail.tm`,
            summarise(normalResult.results, { origin: normalResult.origin }),
          );
        }
        return passed(`allowed from ${normalResult.origin}`, {
          status: entry.status,
          accessControlAllowOrigin: entry.acao,
        });
      },
    );

    await runner.probe(
      "browser.normal-web-page.guerrilla",
      "Normal web page: reach api.guerrillamail.com",
      async () => {
        const entry = normalResult.results.find((r) => r.id === "guerrilla-address");
        if (!entry) return failed("no result recorded for api.guerrillamail.com");
        if (entry.outcome === "blocked") {
          return failed(
            `browser blocked the request from ${normalResult.origin} (${entry.error})`,
            summarise(normalResult.results, { origin: normalResult.origin }),
          );
        }
        return passed(`allowed from ${normalResult.origin}`, {
          status: entry.status,
          accessControlAllowOrigin: entry.acao,
        });
      },
    );

    await runner.probe(
      "browser.normal-web-page.preflight",
      "Normal web page: non-simple (preflighted) request",
      async () => {
        const entry = normalResult.results.find((r) => r.id === "mailtm-preflight-post");
        if (!entry) return failed("no preflight result recorded");
        if (entry.outcome === "blocked") {
          return failed(
            "the CORS preflight for a JSON POST was rejected, so a browser page cannot create a mailbox on this provider",
            { error: entry.error },
          );
        }
        return passed(`allowed (status ${entry.status})`, { status: entry.status });
      },
    );

    // ---- extension context
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/probe.html`, {
      waitUntil: "domcontentloaded",
    });
    const extensionResult = await extensionPage.evaluate(pageProbe, { requests });

    await runner.probe(
      "browser.extension-context.mailtm",
      "Chromium extension context: reach api.mail.tm",
      async () => {
        const entry = extensionResult.results.find((r) => r.id === "mailtm-domains");
        if (!entry) return failed("no result recorded for api.mail.tm");
        if (entry.outcome === "blocked") {
          return failed(
            `blocked even with host permissions granted (${entry.error})`,
            summarise(extensionResult.results, { origin: extensionResult.origin }),
          );
        }
        return passed(
          `allowed from the extension origin ${extensionResult.origin}; host_permissions bypass CORS`,
          {
            status: entry.status,
            accessControlAllowOrigin: entry.acao,
            grantedHostPermissions: fixture.manifest.host_permissions,
          },
        );
      },
    );

    await runner.probe(
      "browser.extension-context.guerrilla",
      "Chromium extension context: reach api.guerrillamail.com",
      async () => {
        const entry = extensionResult.results.find(
          (r) => r.id === "guerrilla-address",
        );
        if (!entry) return failed("no result recorded for api.guerrillamail.com");
        if (entry.outcome === "blocked") {
          return failed(`blocked from the extension origin (${entry.error})`);
        }
        return passed(`allowed from ${extensionResult.origin}`, {
          status: entry.status,
          accessControlAllowOrigin: entry.acao,
        });
      },
    );

    await runner.probe(
      "browser.extension-context.preflight",
      "Chromium extension context: non-simple (preflighted) request",
      async () => {
        const entry = extensionResult.results.find(
          (r) => r.id === "mailtm-preflight-post",
        );
        if (!entry) return failed("no preflight result recorded");
        if (entry.outcome === "blocked") {
          return failed(`preflight rejected from the extension origin (${entry.error})`);
        }
        return passed(`allowed (status ${entry.status})`, { status: entry.status });
      },
    );

    runner.log(`  (chromium launched with ${launchNote})`);
  } finally {
    if (context) await context.close().catch(() => {});
    await pageServer.close();
  }
}
