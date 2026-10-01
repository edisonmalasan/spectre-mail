/**
 * Probe runner for the SpectreMail M0 provider spike.
 *
 * The one hard rule of this harness: a probe may never abort the run. A failure
 * is a *result*, and `unverified` is a distinct result from `passed`. Anything
 * that flattens "blocked by CORS" and "the provider does not support this"
 * into a single boolean would make the spike worthless.
 */

export const OUTCOMES = /** @type {const} */ ([
  "passed",
  "failed",
  "unsupported",
  "unverified",
]);

export const passed = (detail, data) => ({ outcome: "passed", detail, data });
export const failed = (detail, data) => ({ outcome: "failed", detail, data });
export const unsupported = (detail, data) => ({
  outcome: "unsupported",
  detail,
  data,
});
export const unverified = (detail, data) => ({
  outcome: "unverified",
  detail,
  data,
});

export class ProbeRunner {
  #results = [];
  #startedAt = new Date();

  constructor({ log = console.log } = {}) {
    this.log = log;
  }

  get results() {
    return this.#results;
  }

  /**
   * Run one probe and record its outcome. Never throws.
   *
   * @param {string} id stable dotted identifier, e.g. `mailtm.create-account`
   * @param {string} title human readable label for the report
   * @param {() => Promise<{outcome: string, detail: string, data?: any}>} fn
   */
  async probe(id, title, fn) {
    const startedAt = Date.now();
    let result;
    try {
      result = await fn();
    } catch (error) {
      result = failed(describeError(error));
    }
    if (!OUTCOMES.includes(result?.outcome)) {
      result = failed(
        `probe returned an invalid outcome: ${JSON.stringify(result?.outcome)}`,
      );
    }
    const record = {
      id,
      title,
      outcome: result.outcome,
      detail: String(result.detail ?? ""),
      data: result.data === undefined ? null : result.data,
      durationMs: Date.now() - startedAt,
    };
    this.#results.push(record);
    this.log(
      `  [${record.outcome.padEnd(11)}] ${id} — ${record.detail}`,
    );
    return record;
  }

  /** Record an outcome without running anything (for already-known facts). */
  record(id, title, result) {
    const record = {
      id,
      title,
      outcome: result.outcome,
      detail: String(result.detail ?? ""),
      data: result.data === undefined ? null : result.data,
      durationMs: 0,
    };
    this.#results.push(record);
    this.log(
      `  [${record.outcome.padEnd(11)}] ${id} — ${record.detail}`,
    );
    return record;
  }

  section(title) {
    this.log("");
    this.log(title);
  }

  summary() {
    const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0]));
    for (const r of this.#results) counts[r.outcome] += 1;
    return {
      startedAt: this.#startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      total: this.#results.length,
      counts,
      results: this.#results,
    };
  }

  /**
   * Exit code contract: 0 when nothing failed, 1 when any probe failed.
   * `unsupported` and `unverified` are *findings*, not failures — they must be
   * visible in the summary without failing CI-style exit codes, because an
   * honest "we could not check this" is a valid spike outcome.
   */
  exitCode() {
    return this.summary().counts.failed > 0 ? 1 : 0;
  }
}

export function describeError(error) {
  if (!error) return "unknown error";
  if (error instanceof Error) {
    const cause = error.cause ? ` (cause: ${describeError(error.cause)})` : "";
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}

/** Parse a response body as JSON, never throwing. */
export async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __unparsed: text.slice(0, 400) };
  }
}

/** Extract a hydra-style error detail without leaking the whole payload. */
export function hydraDetail(body) {
  if (!body || typeof body !== "object") return null;
  return body.detail ?? body["hydra:description"] ?? body.message ?? null;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
