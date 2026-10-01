/**
 * Header-level CORS corroboration.
 *
 * This is explicitly NOT the primary browser test — see probes/browser.mjs for
 * that. It exists because it is cheap, it is re-runnable without a browser,
 * and it names precisely which origins a provider grants CORS to, which is the
 * single most important fact for the website architecture.
 */

import { failed, passed, unverified } from "../probe-runner.mjs";

const MAILTM = "https://api.mail.tm";
const GUERRILLA = "https://api.guerrillamail.com/ajax.php?f=get_email_address&lang=en";

async function acaoFor(url, origin) {
  const response = await fetch(url, { headers: { Origin: origin } });
  return {
    status: response.status,
    accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
  };
}

export async function runCorsHeaderProbes(runner) {
  runner.section("CORS headers (corroboration only — see browser probes)");

  const probeOrigins = [
    "https://spectre.invalid",
    "http://localhost:5173",
    "https://mail.tm",
  ];

  for (const target of [
    { id: "mailtm", url: MAILTM, label: "api.mail.tm" },
    { id: "guerrilla", url: GUERRILLA, label: "api.guerrillamail.com" },
  ]) {
    await runner.probe(
      `cors-headers.${target.id}`,
      `Which origins does ${target.label} grant CORS to?`,
      async () => {
        const observations = {};
        for (const origin of probeOrigins) {
          try {
            observations[origin] = await acaoFor(target.url, origin);
          } catch (error) {
            observations[origin] = { error: error.message };
          }
        }
        const thirdParty = probeOrigins.filter((o) => !o.includes("mail.tm"));
        // A wildcard grants every third-party origin; an exact echo grants one.
        const grantedToThirdParty = thirdParty.filter((o) => {
          const acao = observations[o]?.accessControlAllowOrigin;
          return acao === "*" || acao === o;
        });
        if (grantedToThirdParty.length === 0) {
          return failed(
            `${target.label} grants no Access-Control-Allow-Origin to any third-party origin; a browser page on our own domain cannot read this API`,
            { observations },
          );
        }
        const wildcard = grantedToThirdParty.some(
          (o) => observations[o]?.accessControlAllowOrigin === "*",
        );
        return passed(
          wildcard
            ? `${target.label} sends Access-Control-Allow-Origin: * , so any browser origin may read it`
            : `${target.label} grants CORS only to specific origins: ${grantedToThirdParty.join(", ")}`,
          { observations },
        );
      },
    );
  }

  await runner.probe(
    "cors-headers.mailtm-preflight",
    "Mail.tm preflight response contents",
    async () => {
      const response = await fetch(`${MAILTM}/accounts`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://spectre.invalid",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      const acao = response.headers.get("access-control-allow-origin");
      const methods = response.headers.get("access-control-allow-methods");
      if (acao) {
        return passed(`preflight granted ${acao}`, {
          status: response.status,
          allowMethods: methods,
        });
      }
      return failed(
        "the preflight response carries no Access-Control-Allow-Origin, so every non-simple browser request fails before it is sent",
        {
          status: response.status,
          allowMethods: methods,
          allowHeaders: response.headers.get("access-control-allow-headers"),
        },
      );
    },
  );

  await runner.probe(
    "cors-headers.guerrilla-credentials",
    "Guerrilla Mail with credentials: include",
    async () => {
      try {
        const response = await fetch(GUERRILLA, { headers: { Origin: "https://spectre.invalid" } });
        const acao = response.headers.get("access-control-allow-origin");
        const acac = response.headers.get("access-control-allow-credentials");
        if (acao === "*" && !acac) {
          return passed(
            "ACAO is * with no allow-credentials, so a browser cannot send the PHPSESSID cookie cross-origin; the body-returned sid_token is the only workable session carrier",
            {
              status: response.status,
              accessControlAllowOrigin: acao,
              accessControlAllowCredentials: acac,
              setCookie: response.headers.get("set-cookie"),
            },
          );
        }
        return unverified(
          "unexpected CORS shape for credentialed requests; re-check before relying on it",
          { accessControlAllowOrigin: acao, accessControlAllowCredentials: acac },
        );
      } catch (error) {
        return unverified(`probe failed: ${error.message}`);
      }
    },
  );
}
