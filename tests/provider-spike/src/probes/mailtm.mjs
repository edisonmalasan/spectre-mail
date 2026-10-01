/**
 * Mail.tm lifecycle probes.
 *
 * Throwaway request code. The real adapter is milestone M3 work and lives in
 * packages/providers — nothing here is importable by product code.
 */

import {
  failed,
  hydraDetail,
  passed,
  readJson,
  sleep,
  unverified,
  unsupported,
} from "../probe-runner.mjs";

export const MAILTM_API = "https://api.mail.tm";

const CANDIDATE_SSE_PATHS = [
  "/messages/events",
  "/events",
  "/messages/sse",
  "/sse",
  "/events/messages",
];

const CANDIDATE_WS_URLS = [
  "wss://api.mail.tm/events",
  "wss://api.mail.tm/messages/events",
];

const jsonHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  ...extra,
});

async function api(path, init = {}) {
  const response = await fetch(`${MAILTM_API}${path}`, init);
  return { response, body: await readJson(response) };
}

function randomLocalPart() {
  return `spike${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function randomPassword() {
  return `Sp!ke-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Serialised account-creation gate.
 *
 * Mail.tm advertises `ratelimit-policy: 1; w=60` on POST /accounts — one
 * account per minute per IP. The spike must not blow through a real provider's
 * budget, so creation calls are queued with a configurable floor between them.
 */
export function createAccountGate(minIntervalMs = Number(process.env.SPECTRE_SPIKE_MAILTM_ACCOUNT_INTERVAL_MS ?? 62000)) {
  let chain = Promise.resolve();
  let last = 0;
  return function withGate(fn) {
    const run = chain.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      return fn();
    });
    // Keep the chain alive even when a probe throws.
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

export async function runMailTmProbes(runner, { gate = createAccountGate() } = {}) {
  /** @type {{address: string|null, token: string|null, accountId: string|null, accountUrl: string|null}} */
  const ctx = {
    address: null,
    token: null,
    accountId: null,
    accountUrl: null,
  };

  runner.section("Mail.tm — lifecycle");

  let domainsBody = null;

  await runner.probe("mailtm.domains", "Fetch available domains", async () => {
    const { response, body } = await api("/domains?page=1");
    domainsBody = body;
    if (!response.ok) {
      return failed(`GET /domains returned ${response.status}`);
    }
    const members = body?.["hydra:member"] ?? [];
    if (members.length === 0) {
      return failed("GET /domains returned an empty collection");
    }
    return passed(`${members.length} active domain(s) advertised`, {
      status: response.status,
      domains: members.map((d) => d.domain),
      ratelimitPolicy: response.headers.get("ratelimit-policy"),
      totalItems: body?.["hydra:totalItems"] ?? null,
    });
  });

  await runner.probe("mailtm.create-account", "Create mailbox account", async () => {
    const domain = domainsBody?.["hydra:member"]?.[0]?.domain;
    if (!domain) {
      return unverified(
        "no domain available to create an account with (domain discovery did not succeed)",
      );
    }
    const address = `${randomLocalPart()}@${domain}`;
    const password = randomPassword();

    const { response, body } = await gate(() =>
      api("/accounts", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ address, password }),
      }),
    );

    ctx.address = address;
    ctx.password = password;
    ctx.accountId = body?.id ?? null;
    ctx.accountUrl = body?.["@id"] ?? null;

    if (response.status === 429) {
      return failed(
        `POST /accounts rate limited (429); advertised policy was "${response.headers.get("ratelimit-policy")}"`,
        { ratelimitPolicy: response.headers.get("ratelimit-policy") },
      );
    }
    if (response.status !== 201) {
      return failed(
        `POST /accounts returned ${response.status}: ${hydraDetail(body) ?? "no detail"}`,
      );
    }
    return passed(`account ${address} created`, {
      status: response.status,
      accountId: ctx.accountId,
      accountUrl: ctx.accountUrl,
      quota: body?.quota ?? null,
      ratelimitPolicy: response.headers.get("ratelimit-policy"),
    });
  });

  await runner.probe("mailtm.token", "Authenticate and obtain a bearer token", async () => {
    if (!ctx.address) {
      return unverified("no account was created, so authentication was not attempted");
    }
    const { response, body } = await api("/token", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ address: ctx.address, password: ctx.password }),
    });
    if (response.status !== 200 || !body?.token) {
      return failed(
        `POST /token returned ${response.status}: ${hydraDetail(body) ?? "no token issued"}`,
      );
    }
    ctx.token = body.token;
    return passed(`bearer token issued (${body.token.length} chars)`, {
      status: response.status,
      tokenLength: body.token.length,
    });
  });

  const authHeaders = () =>
    ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {};

  await runner.probe("mailtm.me", "Read the authenticated mailbox", async () => {
    if (!ctx.token) return unverified("no bearer token, so /me was not attempted");
    const { response, body } = await api("/me", { headers: authHeaders() });
    if (response.status !== 200) {
      return failed(`GET /me returned ${response.status}`);
    }
    if (body?.address !== ctx.address) {
      return failed(`GET /me returned a different address than created`);
    }
    return passed(`GET /me confirms ${body.address}`, {
      status: response.status,
      id: body?.id ?? null,
      quota: body?.quota ?? null,
      used: body?.used ?? null,
    });
  });

  await runner.probe("mailtm.list-messages", "List messages (empty inbox)", async () => {
    if (!ctx.token) return unverified("no bearer token, so listing was not attempted");
    const { response, body } = await api("/messages?page=1", { headers: authHeaders() });
    if (response.status !== 200) {
      return failed(`GET /messages returned ${response.status}`);
    }
    return passed(`inbox listed (${body?.["hydra:totalItems"] ?? 0} message(s))`, {
      status: response.status,
      totalItems: body?.["hydra:totalItems"] ?? null,
      sample: (body?.["hydra:member"] ?? []).slice(0, 1).map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        intro: m.intro,
      })),
    });
  });

  await runner.probe(
    "mailtm.list-messages-page-2",
    "List messages past the end of the collection",
    async () => {
      if (!ctx.token) return unverified("no bearer token, so pagination was not attempted");
      const { response, body } = await api("/messages?page=2", { headers: authHeaders() });
      if (response.status !== 200) {
        return failed(`GET /messages?page=2 returned ${response.status}`);
      }
      const members = body?.["hydra:member"] ?? [];
      if (members.length !== 0) {
        return failed(`page 2 of an empty inbox returned ${members.length} member(s)`);
      }
      return passed("pagination past the end returns an empty collection", {
        status: response.status,
        totalItems: body?.["hydra:totalItems"] ?? null,
      });
    },
  );

  await runner.probe(
    "mailtm.fetch-unknown-message",
    "Fetch an unknown message (provider error shape)",
    async () => {
      if (!ctx.token) return unverified("no bearer token, so the 404 shape was not probed");
      const { response, body } = await api(
        "/messages/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders() },
      );
      if (response.status !== 404) {
        return failed(
          `GET an unknown message returned ${response.status}, expected 404`,
        );
      }
      return passed(`404 with a hydra error body`, {
        status: response.status,
        title: body?.title ?? null,
        detail: hydraDetail(body),
        type: body?.type ?? null,
      });
    },
  );

  await runner.probe("mailtm.validation-error", "Invalid create payload", async () => {
    const { response, body } = await api("/accounts", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ address: "not-an-email", password: "x" }),
    });
    if (response.status !== 422) {
      return failed(
        `POST /accounts with an invalid address returned ${response.status}, expected 422`,
      );
    }
    return passed("422 ConstraintViolationList returned", {
      status: response.status,
      violations: (body?.violations ?? []).map((v) => ({
        propertyPath: v.propertyPath,
        message: v.message,
      })),
    });
  });

  await runner.probe("mailtm.auth-error", "Wrong password", async () => {
    if (!ctx.address) return unverified("no account was created, so auth failure was not probed");
    const { response, body } = await api("/token", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ address: ctx.address, password: "definitely-wrong" }),
    });
    if (response.status !== 401) {
      return failed(
        `POST /token with a wrong password returned ${response.status}, expected 401`,
      );
    }
    return passed("401 for a wrong password", {
      status: response.status,
      detail: hydraDetail(body),
    });
  });

  await runner.probe(
    "mailtm.rate-limit-headers",
    "Advertised rate-limit budgets",
    async () => {
      const domains = await fetch(`${MAILTM_API}/domains?page=1`);
      const readDomains = domains.headers.get("ratelimit-policy");
      const readMessages = await fetch(`${MAILTM_API}/messages`);
      const readMessagesPolicy = readMessages.headers.get("ratelimit-policy");
      return passed("rate-limit policies observed on read endpoints", {
        "GET /domains": readDomains,
        "GET /messages (unauthenticated)": readMessagesPolicy,
        note:
          "Account creation advertised its own policy in the create probe above; " +
          "this probe records the read budgets only.",
      });
    },
  );

  runner.section("Mail.tm — real-time transport");

  await runner.probe(
    "mailtm.realtime-sse",
    "Probe candidate SSE endpoints",
    async () => {
      if (!ctx.token) {
        return unverified("no bearer token, so real-time probes were not attempted");
      }
      const observations = [];
      let streamOpened = false;

      for (const path of CANDIDATE_SSE_PATHS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(`${MAILTM_API}${path}`, {
            headers: { ...authHeaders(), Accept: "text/event-stream" },
            signal: controller.signal,
          });
          const contentType = response.headers.get("content-type");
          const observation = {
            path,
            status: response.status,
            contentType,
          };
          if ((contentType ?? "").includes("text/event-stream")) {
            const reader = response.body.getReader();
            const { value, done } = await reader.read();
            observation.firstChunk = done
              ? "[stream closed with no data]"
              : new TextDecoder().decode(value).slice(0, 200);
            observation.streamed = !done;
            streamOpened = streamOpened || !done;
            await reader.cancel();
          } else {
            const body = await readJson(response);
            observation.detail = hydraDetail(body) ?? body?.__unparsed ?? null;
          }
          observations.push(observation);
        } catch (error) {
          observations.push({ path, error: error.name });
        } finally {
          clearTimeout(timer);
        }
      }

      if (streamOpened) {
        return passed("an SSE stream opened", { observations });
      }
      return unsupported(
        "no SSE endpoint: every candidate path answered 404/406 and no event stream opened",
        { observations },
      );
    },
  );

  await runner.probe(
    "mailtm.realtime-websocket",
    "Probe candidate WebSocket endpoints",
    async () => {
      if (!ctx.token) {
        return unverified("no bearer token, so websocket probes were not attempted");
      }
      const observations = [];
      let opened = false;
      for (const url of CANDIDATE_WS_URLS) {
        const result = await new Promise((resolve) => {
          let settled = false;
          const done = (value) => {
            if (!settled) {
              settled = true;
              resolve(value);
            }
          };
          const timer = setTimeout(() => done({ url, result: "timeout, no open" }), 5000);
          let socket;
          try {
            socket = new WebSocket(url, undefined, { headers: authHeaders() });
          } catch (error) {
            clearTimeout(timer);
            done({ url, result: "construct failed", error: error.name });
            return;
          }
          socket.addEventListener("open", () => {
            clearTimeout(timer);
            socket.close();
            done({ url, result: "opened" });
          });
          socket.addEventListener("error", () => {
            clearTimeout(timer);
            done({ url, result: "error" });
          });
        });
        if (result.result === "opened") opened = true;
        observations.push(result);
      }
      if (opened) {
        return passed("a websocket endpoint accepted a connection", { observations });
      }
      return unsupported("no websocket endpoint accepted a connection", { observations });
    },
  );

  runner.section("Mail.tm — mailbox deletion");

  await runner.probe("mailtm.delete-account", "Delete the mailbox", async () => {
    if (!ctx.token || !ctx.accountUrl) {
      return unverified("no authenticated account, so deletion was not attempted");
    }
    const { response, body } = await api(ctx.accountUrl, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (response.status !== 204) {
      return failed(
        `DELETE ${ctx.accountUrl} returned ${response.status}${body ? `: ${hydraDetail(body) ?? ""}` : ""}`,
      );
    }
    const after = await api("/me", { headers: authHeaders() });
    const tokenAfter = await api("/token", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ address: ctx.address, password: ctx.password }),
    });
    return passed("mailbox deleted and no longer usable", {
      deleteStatus: response.status,
      meAfterDelete: after.response.status,
      tokenAfterDelete: tokenAfter.response.status,
    });
  });

  return ctx;
}
