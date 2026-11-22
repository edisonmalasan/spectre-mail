/**
 * DropMail OAuth 2.1 authorization-code + PKCE feasibility in a real MV3 service worker.
 *
 * ## What this is, and is not
 *
 * A **quarantined measurement instrument**, not a test and not an integration. It is not in
 * `package.json`'s scripts, and no browser suite collects it: it contacts a third party, and
 * it loads a throwaway extension that declares an `identity` permission the product must not
 * ship. Run it by hand with:
 *
 *     node apps/extension/e2e/dropmail-oauth.mjs
 *
 * It **never** adds DropMail to a shipped provider list, adapter registry or manifest. The
 * fixture manifest is generated into the OS temporary directory and deleted afterwards.
 *
 * ## Secrets contract (load-bearing)
 *
 * No token, authorization code, PKCE verifier, client id or client secret is ever printed,
 * written to a file, embedded in a committed artefact, or stored in browser-visible global
 * state. The PKCE verifier lives only in the throwaway worker's module scope for the lifetime
 * of one context and is cleared before the context closes; the driver sees only lengths and
 * booleans. Dynamic client registration, which creates per-run values, is performed in the
 * Node driver and only its *shape* is reported. The real authorize URL is built with PLACEHOLDER
 * values, never with a registered client id, because an OAuth authorize URL necessarily puts
 * its parameters in a URL and this instrument does not put a credential in one.
 *
 * ## What it measures
 *
 * | arm | question |
 * | --- | -------- |
 * | A1 | does `identity.getRedirectURL` produce `https://<id>.chromiumapp.org/*`, and is `launchWebAuthFlow` present in the worker? |
 * | A2 | can the worker generate an S256 PKCE pair and verify it, without exposing either value? |
 * | A3 | what does the provider's RFC 8414 metadata actually declare? (one public GET) |
 * | A4 | does documented dynamic client registration accept that generated redirect URI? (one POST) |
 * | A5 | does Chromium intercept a redirect to the generated URI, measured with a LOCAL fixture? |
 * | A6 | what does the documented authorize endpoint do under `interactive: false`? (no credential in the URL) |
 * | A7 | token exchange — requires a human-produced code, so BLOCKED here |
 * | A8 | revocation and expiry — requires a token, so BLOCKED here |
 * | A9 | can extension identity and a probe-owned fixture value survive a browser-session restart? |
 * | A10 | the minimal GraphQL operations — require a token, so BLOCKED here |
 * | A11 | website CORS — carried from the dated 2026-11-22 measurement, not re-run |
 *
 * Arms A7, A8 and A10 are recorded as BLOCKED with their exact resume condition. **A blocked
 * arm is never rounded to a pass, and no provider is claimed to be integrated or supported.**
 *
 * ## How the extension is loaded
 *
 * `chromium.launchPersistentContext` with an absolute path and BOTH measured flags —
 * `--load-extension=<ABS>` and `--disable-extensions-except=<ABS>` — as `extensionFlags()` in
 * `playwright.config.ts` declares. Chromium reports no error when an extension fails to load;
 * it silently loads nothing, so the worker's published surface is checked by its keys first.
 */

import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const RUN_AT = new Date().toISOString();
const PROBE_KEY = "__dropmailOAuthProbe";
const METADATA_URL = "https://dropmail.me/.well-known/oauth-authorization-server";
const NETWORK_TIMEOUT_MS = 20_000;
const WEB_AUTH_TIMEOUT_MS = 15_000;
const RESTORATION_KEY = "__dropmailOAuthRestorationFixture";
const RESTORATION_VALUE = "stable-fixture-value-v1";

/** The worker surface. `chrome.*` here is inside a *string* written to a temp file, not shipped source. */
const WORKER_SOURCE = `
const KEY = "${PROBE_KEY}";
let verifier = null;
let challenge = null;

const b64url = (bytes) => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
};

const sha256 = async (text) => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return b64url(new Uint8Array(digest));
};

const platform = () => Reflect.get(globalThis, "chrome");

self[KEY] = {
  apiReport() {
    const c = platform();
    const identity = c && Reflect.get(c, "identity");
    return {
      identityPresent: !!(identity && typeof Reflect.get(identity, "getRedirectURL") === "function"),
      launchWebAuthFlowPresent: !!(identity && typeof Reflect.get(identity, "launchWebAuthFlow") === "function"),
      storagePresent: !!(c && Reflect.get(c, "storage")),
      extensionId: c ? Reflect.get(c, "runtime").id : null,
      redirectURL: identity ? Reflect.get(identity, "getRedirectURL")("callback") : null,
    };
  },

  async makePkce() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    verifier = b64url(raw);
    challenge = await sha256(verifier);
    return {
      verifierLength: verifier.length,
      challengeLength: challenge.length,
      distinct: verifier !== challenge,
      verifierIsBase64Url: /^[A-Za-z0-9_-]+$/.test(verifier),
      challengeIsBase64Url: /^[A-Za-z0-9_-]+$/.test(challenge),
    };
  },

  async pkceSelfCheck() {
    if (!verifier || !challenge) return { held: false, matches: false };
    const recomputed = await sha256(verifier);
    return { held: true, matches: recomputed === challenge };
  },

  clearPkce() {
    verifier = null;
    challenge = null;
    return { held: false };
  },

  async runWebAuthFlow(url, interactive, timeoutMs) {
    const c = platform();
    const identity = c && Reflect.get(c, "identity");
    if (!identity || typeof Reflect.get(identity, "launchWebAuthFlow") !== "function") {
      return { ok: false, error: "identity.launchWebAuthFlow is not available" };
    }
    const call = Reflect.get(identity, "launchWebAuthFlow")({ url, interactive: !!interactive });
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, error: "TIMEOUT after " + timeoutMs + "ms" }), timeoutMs);
    });
    try {
      const result = await Promise.race([call.then((finalUrl) => {
        let origin = null;
        try { origin = new URL(finalUrl).origin; } catch { origin = "(unparseable)"; }
        return {
          ok: true,
          finalOrigin: origin,
          expectedRedirectOrigin: (() => { try { return new URL(self[KEY].apiReport().redirectURL).origin; } catch { return null; } })(),
          hasCode: /[?&]code=/.test(finalUrl),
          hasState: /[?&]state=/.test(finalUrl),
        };
      }).catch((cause) => ({ ok: false, error: String(cause) })), timeout]);
      return result;
    } finally {
      clearTimeout(timer);
    }
  },

  storageWrite(key, value) {
    return new Promise((resolve) => {
      const c = platform();
      Reflect.get(Reflect.get(c, "storage"), "local").set({ [key]: value }, () => {
        resolve({ ok: !c || !c.runtime.lastError });
      });
    });
  },

  storageRead(key) {
    return new Promise((resolve) => {
      const c = platform();
      Reflect.get(Reflect.get(c, "storage"), "local").get(key, (result) => {
        resolve({ present: Object.prototype.hasOwnProperty.call(result || {}, key) });
      });
    });
  },
};
`;

function say(line = "") {
  process.stdout.write(`${line}\n`);
}

/** Strip query values and long opaque tokens from anything printed, so no value can leak. */
function scrub(value) {
  return String(value ?? "")
    .replace(/[?&]([^?&=]+)=[^&\s]*/g, (_m, key) => `${key}=REDACTED`)
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, "REDACTED");
}

function writeFixture(directory) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "manifest.json"),
    `${JSON.stringify(
      {
        manifest_version: 3,
        name: "DropMail OAuth feasibility probe (quarantined)",
        version: "0.0.0",
        permissions: ["identity", "storage"],
        host_permissions: ["https://dropmail.me/*"],
        background: { service_worker: "probe.js", type: "module" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(join(directory, "probe.js"), WORKER_SOURCE, "utf8");
}

/** Both load flags, spelled — a plain .mjs cannot import the TypeScript helper. */
function probeFlags(resolvedDir) {
  return [`--load-extension=${resolvedDir}`, `--disable-extensions-except=${resolvedDir}`];
}

async function launch(dir, profileDir) {
  // `channel: "chromium"` is the measured full-Chromium requirement for MV3 loading.
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    args: [...probeFlags(dir), "--no-first-run"],
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    try {
      worker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    } catch (cause) {
      await context.close();
      throw new Error(
        `no service worker registered: ${scrub(cause)}. Both flags and an absolute path are required.`,
      );
    }
  }
  const published = await worker.evaluate((key) => {
    const surface = self[key];
    return surface ? Object.keys(surface).sort() : null;
  }, PROBE_KEY);
  if (!published) {
    await context.close();
    throw new Error(
      `no probe surface at self["${PROBE_KEY}"] — instrument fault, not a platform finding`,
    );
  }
  return { context, worker, published };
}

async function call(worker, method, argument) {
  return worker.evaluate(
    async ([key, name, payload]) => {
      const surface = self[key];
      if (!surface || typeof surface[name] !== "function") {
        return { __missingMethod: name };
      }
      return surface[name](...(payload === null ? [] : payload));
    },
    [PROBE_KEY, method, argument ?? null],
  );
}

async function fetchMetadata() {
  const response = await fetch(METADATA_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  const body = await response.json();
  return {
    httpStatus: response.status,
    issuer: body?.issuer ?? null,
    authorization_endpoint: body?.authorization_endpoint ?? null,
    token_endpoint: body?.token_endpoint ?? null,
    registration_endpoint: body?.registration_endpoint ?? null,
    revocation_endpoint: body?.revocation_endpoint ?? null,
    grant_types_supported: body?.grant_types_supported ?? null,
    response_types_supported: body?.response_types_supported ?? null,
    code_challenge_methods_supported: body?.code_challenge_methods_supported ?? null,
    token_endpoint_auth_methods_supported: body?.token_endpoint_auth_methods_supported ?? null,
  };
}

async function registerClient(registrationEndpoint, redirectURL) {
  const response = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectURL],
      client_name: "SpectreMail OAuth feasibility probe (quarantined)",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      code_challenge_method: "S256",
    }),
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);
  return {
    httpStatus: response.status,
    returnedClientId: typeof body?.client_id === "string",
    returnedClientSecret: typeof body?.client_secret === "string",
    redirectUriEchoed:
      Array.isArray(body?.redirect_uris) && body.redirect_uris.includes(redirectURL),
    grantTypesEchoed: Array.isArray(body?.grant_types) ? body.grant_types.join(",") : null,
    errorCode: body?.error ?? null,
    errorDescriptionRedacted: scrub(body?.error_description ?? ""),
    // The value stays in this Node process for the duration of the run and is never returned.
    clientId: typeof body?.client_id === "string" ? body.client_id : null,
  };
}

/** A LOCAL redirect fixture: nothing leaves the machine, no credential is involved. */
async function localRedirectFixture(redirectURL, worker) {
  const server = createServer((_request, response) => {
    response.writeHead(302, {
      Location: `${redirectURL}?code=local-fixture-code&state=local-fixture-state`,
    });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const outcome = await call(worker, "runWebAuthFlow", [
      `http://127.0.0.1:${port}/authorize?state=local-fixture-state`,
      false,
      WEB_AUTH_TIMEOUT_MS,
    ]);
    return {
      localUrlOrigin: `http://127.0.0.1:${port}`,
      ...outcome,
      error: outcome.error ? scrub(outcome.error) : null,
    };
  } finally {
    server.close();
  }
}

async function providerAuthorizeShape(metadata, redirectURL, worker) {
  if (!metadata.authorization_endpoint) {
    return { attempted: false, reason: "metadata declared no authorization_endpoint" };
  }
  // PLACEHOLDERS only: no registered client id, no real verifier, no token.
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "probe-placeholder-not-a-credential");
  url.searchParams.set("redirect_uri", redirectURL);
  url.searchParams.set("code_challenge", "x".repeat(43));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", "local-fixture-state");

  const outcome = await call(worker, "runWebAuthFlow", [
    url.toString(),
    false,
    WEB_AUTH_TIMEOUT_MS,
  ]);
  return {
    attempted: true,
    urlHadRealClientId: false,
    urlHadRealVerifier: false,
    ...outcome,
    error: outcome.error ? scrub(outcome.error) : null,
  };
}

async function main() {
  let root = null;
  let liveCalls = 0;
  const observations = [];
  const note = (arm, result) => {
    observations.push({ arm, observed: true });
    return result;
  };

  say(`dropmail-oauth — MV3 OAuth/PKCE feasibility probe (quarantined, not an integration)`);
  say(`runAt          ${RUN_AT}`);
  say(`node           ${process.version}`);
  say(`command        node apps/extension/e2e/dropmail-oauth.mjs`);
  say(`base           ${METADATA_URL}`);

  try {
    root = mkdtempSync(join(tmpdir(), "spectre-dropmail-oauth-"));
    const dir = join(root, "extension");
    const profileDir = join(root, "profile");
    writeFixture(dir);

    const first = await launch(dir, profileDir);
    say(`surface        ${JSON.stringify(first.published)}`);

    // --- A1: identity surface -------------------------------------------------------
    const api = note("A1 identity surface", await call(first.worker, "apiReport"));
    say(`\n[A1] chrome.identity in the MV3 service worker`);
    say(`    identity.getRedirectURL  ${api.identityPresent}`);
    say(`    identity.launchWebAuthFlow ${api.launchWebAuthFlowPresent}`);
    say(`    storage available        ${api.storagePresent}`);
    say(`    extensionId              ${scrub(api.extensionId)}`);
    say(`    redirectURL              ${scrub(api.redirectURL)}`);
    const redirectURL = api.redirectURL;
    const redirectPattern = /^https:\/\/[a-p]{32}\.chromiumapp\.org\/callback$/;
    say(
      `    generated <id>.chromiumapp.org/callback shape  ${
        typeof redirectURL === "string" && redirectPattern.test(redirectURL)
      }`,
    );

    // --- A2: PKCE, values never cross the boundary ---------------------------------
    const pkce = note("A2 PKCE generation", await call(first.worker, "makePkce"));
    const check = note("A2 PKCE self-check", await call(first.worker, "pkceSelfCheck"));
    say(`\n[A2] PKCE S256 generated inside the worker (values redacted)`);
    say(`    verifier length          ${pkce.verifierLength}`);
    say(`    challenge length         ${pkce.challengeLength}`);
    say(`    distinct                 ${pkce.distinct}`);
    say(`    base64url verifier       ${pkce.verifierIsBase64Url}`);
    say(`    base64url challenge      ${pkce.challengeIsBase64Url}`);
    say(`    held / recomputed match  ${check.held} / ${check.matches}`);

    // --- A3: RFC 8414 metadata (ONE public GET) ------------------------------------
    let metadata = null;
    try {
      liveCalls += 1;
      metadata = note("A3 oauth metadata", await fetchMetadata());
      say(`\n[A3] RFC 8414 metadata (one public GET: ${METADATA_URL})`);
      for (const key of [
        "httpStatus",
        "issuer",
        "authorization_endpoint",
        "token_endpoint",
        "registration_endpoint",
        "revocation_endpoint",
        "grant_types_supported",
        "response_types_supported",
        "code_challenge_methods_supported",
        "token_endpoint_auth_methods_supported",
      ]) {
        say(`    ${key.padEnd(34)} ${JSON.stringify(metadata[key])}`);
      }
    } catch (cause) {
      say(`\n[A3] metadata GET FAILED: ${scrub(cause)}`);
      observations.push({ arm: "A3 oauth metadata", observed: false });
    }

    // --- A4: dynamic client registration (ONE POST) --------------------------------
    let registration = null;
    if (metadata?.registration_endpoint && typeof redirectURL === "string") {
      try {
        liveCalls += 1;
        registration = await registerClient(metadata.registration_endpoint, redirectURL);
        note("A4 dynamic registration", {
          httpStatus: registration.httpStatus,
          returnedClientId: registration.returnedClientId,
        });
        say(`\n[A4] dynamic client registration (one POST; all returned values redacted)`);
        say(`    http status              ${registration.httpStatus}`);
        say(`    returned client id       ${registration.returnedClientId}`);
        say(`    returned client secret   ${registration.returnedClientSecret}`);
        say(`    redirect URI echoed      ${registration.redirectUriEchoed}`);
        say(`    grant types echoed       ${JSON.stringify(registration.grantTypesEchoed)}`);
        say(`    error code               ${JSON.stringify(registration.errorCode)}`);
        say(
          `    error description        ${JSON.stringify(registration.errorDescriptionRedacted)}`,
        );
      } catch (cause) {
        say(`\n[A4] registration POST FAILED: ${scrub(cause)}`);
        observations.push({ arm: "A4 dynamic registration", observed: false });
      }
    } else {
      say(`\n[A4] NOT ATTEMPTED — no registration_endpoint or no generated redirect URI`);
    }

    // --- A5: local redirect interception ------------------------------------------
    if (typeof redirectURL === "string") {
      const local = note(
        "A5 local redirect",
        await localRedirectFixture(redirectURL, first.worker),
      );
      say(`\n[A5] LOCAL redirect interception (no provider, no credential)`);
      say(`    local origin             ${local.localUrlOrigin}`);
      say(`    ok                       ${local.ok}`);
      say(`    final origin             ${JSON.stringify(local.finalOrigin ?? null)}`);
      say(`    expected redirect origin ${JSON.stringify(local.expectedRedirectOrigin ?? null)}`);
      say(`    carried code / state     ${local.hasCode} / ${local.hasState}`);
      say(`    error                    ${JSON.stringify(local.error ?? null)}`);
    }

    // --- A6: provider authorize endpoint, placeholders only ------------------------
    if (metadata) {
      const shape = note(
        "A6 provider authorize shape",
        await providerAuthorizeShape(metadata, redirectURL, first.worker),
      );
      say(`\n[A6] documented authorize endpoint, interactive:false, NO credential in the URL`);
      say(`    attempted                ${shape.attempted}`);
      say(`    url had real client id   ${shape.urlHadRealClientId}`);
      say(`    url had real verifier    ${shape.urlHadRealVerifier}`);
      say(`    ok                       ${shape.ok ?? null}`);
      say(`    error                    ${JSON.stringify(shape.error ?? shape.reason ?? null)}`);
    }

    // --- A7/A8/A10: gated on a human-produced code or a token ----------------------
    say(`\n[A7] TOKEN EXCHANGE — BLOCKED`);
    say(`    Resume condition: a per-user authorization code from a completed interactive login;`);
    say(
      `    the token endpoint is ${metadata?.token_endpoint ?? "unknown"}. No token was requested.`,
    );
    say(`\n[A8] REVOCATION / EXPIRY — BLOCKED`);
    say(
      `    Resume condition: a per-run token; revocation endpoint is ${metadata?.revocation_endpoint ?? "unknown"}.`,
    );
    say(`    Documented token durations were not exercised, and no token was requested.`);
    say(`\n[A10] MINIMAL GRAPHQL OPERATIONS — BLOCKED (no token)`);
    for (const op of [
      "live domain listing (expiry/health, free vs rotating flags)",
      "mailbox creation",
      "mailbox listing",
      "reading one message",
      "error mapping",
    ]) {
      say(`    BLOCKED  ${op}`);
    }
    say(`    Resume condition: a per-user OAuth token obtained through an interactive login.`);

    // --- A9: browser-session restoration substrate --------------------------------
    await call(first.worker, "storageWrite", [RESTORATION_KEY, RESTORATION_VALUE]);
    const beforeClear = note(
      "A9 PKCE held before restart",
      await call(first.worker, "pkceSelfCheck"),
    );
    say(`\n[A9] browser-session restart (same profile)`);
    say(`    PKCE held before restart ${beforeClear.held}`);
    await call(first.worker, "clearPkce");
    await first.context.close();

    const second = await launch(dir, profileDir);
    const restoredId = note("A9 restored identity", await call(second.worker, "apiReport"));
    const restoredValue = note(
      "A9 restored fixture value",
      await call(second.worker, "storageRead", [RESTORATION_KEY]),
    );
    const afterClear = note("A9 PKCE after restart", await call(second.worker, "pkceSelfCheck"));
    say(`    extension id restored    ${scrub(restoredId.extensionId) === scrub(api.extensionId)}`);
    say(`    redirect URL restored    ${scrub(restoredId.redirectURL) === scrub(api.redirectURL)}`);
    say(`    fixture value restored   ${restoredValue.present}`);
    say(
      `    PKCE held after restart  ${afterClear.held} (worker memory does not survive; a token would need deliberate persistence)`,
    );
    await second.context.close();

    // --- A11: website CORS, carried from the dated measurement ---------------------
    say(`\n[A11] WEBSITE CORS — BLOCKED (carried, not re-run)`);
    say(`    docs/provider-research/dropmail.md §4 measured no ACAO on 2026-11-22;`);
    say(`    no repeatable real-page test was run here, and no proxy or backend was added.`);

    // --- summary -------------------------------------------------------------------
    const missing = observations.filter((o) => !o.observed).map((o) => o.arm);
    say(`\n[summary] live provider calls: ${liveCalls} (metadata GET + registration POST only)`);
    say(
      `[summary] arms that produced an observation: ${observations.filter((o) => o.observed).length}/${observations.length}`,
    );
    if (missing.length) say(`[summary] arms that measured nothing: ${missing.join(", ")}`);
    say(`[summary] no token, code, verifier, client id or client secret was printed or stored.`);
    if (registration?.clientId) registration.clientId = null;
    process.exit(missing.length ? 1 : 0);
  } catch (cause) {
    say(`\nHARNESS ERROR: ${scrub(cause)}`);
    process.exit(1);
  } finally {
    if (root) rmSync(root, { recursive: true, force: true });
  }
}

await main();
