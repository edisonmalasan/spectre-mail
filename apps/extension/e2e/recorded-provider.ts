/**
 * Recorded provider traffic for the extension's browser tier.
 *
 * ## Every provider response here is a recorded one
 *
 * **No test in this tier contacts a live provider**, and that is the same rule the
 * website's tier follows and the same limit: `use it externally` stays unverified, and
 * the polling cadence has still never been run against a real provider. What this buys
 * is that the *extension's* own wiring — host permissions in a `chrome-extension://`
 * context, `chrome.storage`, the popup's composition — is exercised for real.
 *
 * ## The fixtures are imported by name, never restated
 *
 * **That is not tidiness, and this file's first version got it wrong.** It transcribed
 * the recorded bodies inline, which put four provider field names under `apps/` — and
 * `tests/architecture/boundaries.test.ts` forbids provider wire format there with **no
 * test exemption at all**, so the architecture suite went red before anything was
 * pushed. The rule was right and the file was wrong, so the fix was to import rather
 * than to ask for an exemption: the website's tier has always done it this way, and its
 * module note explains why.
 *
 * The consequence is better than the tidiness: **the served bodies are the measured
 * ones**, so a spec asserting on a count is asserting on what the provider actually
 * returned rather than on a value invented to make a sentence appear.
 *
 * ## Any other origin is aborted and named, rather than passed through
 *
 * `apps/web/e2e/recorded-provider.ts` records every URL the page requested whatever its
 * origin and aborts the ones it has no script for. **The same rule here, and the reason
 * is sharper for an extension**: an extension with host permissions is exactly the kind
 * of program that could quietly reach something, so a request to an origin no test
 * scripted is a finding to be printed, not a request to be served.
 */

import type { BrowserContext } from "@playwright/test";

import {
  FIXTURE_IDS,
  guerrillaLiveList,
  guerrillaMessageFetched,
  guerrillaMessageWithVerificationLink,
  guerrillaSessionCreated,
  guerrillaThrottled,
  guerrillaUnclassifiable,
  mailtmAccountCreated,
  mailtmDomains,
  mailtmMessageFetched,
  mailtmMessageList,
  mailtmThrottled,
  mailtmToken,
} from "../../../packages/providers/src/fixtures";
import type { RecordedStep } from "../../../packages/providers/src/recorder";

/**
 * Mail.tm's account creation, as the adapter spells it in a URL.
 *
 * **One constant rather than three literals.** The gate, the throttle, and the spec that
 * counts requests all have to name the same request, and a spec that retyped the path
 * would silently hold nothing if the adapter's spelling ever changed - a gate that never
 * fires is indistinguishable from no gate at all.
 */
export const MAILTM_ACCOUNTS = "https://api.mail.tm/accounts";

/**
 * Guerrilla Mail's single operation, as the adapter spells it in a URL.
 *
 * **One constant for the same reason as {@link MAILTM_ACCOUNTS}**, and this one has a
 * query parameter behind it: the adapter spells the operation in `f`, so a spec that
 * matched on a bare host would also match nothing here.
 */
export const GUERRILLA_AJAX = "https://api.guerrillamail.com/ajax.php";

/**
 * The query parameter {@link GUERRILLA_AJAX}'s adapter spells its operation in, and the two
 * operations a body-verdict staging has to tell apart.
 *
 * **A URL's spelling, not a response field, and that distinction is why these names can live
 * under `apps/`.** `tests/architecture`'s provider-wire rule forbids seven **response field
 * names** - `mail_id`, `sid_token`, `content_type` and four others - and the operation is none
 * of them: it travels in the query string and this file already documents its existence on
 * {@link GUERRILLA_AJAX}. **A stage that matched a bare host would match both operations and
 * stage nothing**, and a stage that guessed which is which would stage the wrong answer
 * confidently, so both are named rather than inferred.
 *
 * **Exported so a spec can say what it staged rather than re-typing it.**
 */
export const GUERRILLA_OPERATION_PARAMETER = "f";

/** The listing request. */
export const GUERRILLA_LIST_OPERATION = "check_email";

/** The one-body read, which is what decides a verdict. */
export const GUERRILLA_READ_OPERATION = "fetch_email";

/**
 * The recorded answers a spec can stage for a body read, by name.
 *
 * **A list rather than a free `RecordedStep`, and the reason is that every one of these is a
 * fixture this repository already holds** - a spec naming its own response would transcribe a
 * provider body into `apps/`, which is the defect this file's own header records having been
 * made once already. **So the choice is which recorded fixture answers the read, not what the
 * read returns.**
 *
 * **`none` is the default and it is a real answer.** With no option, the read is answered with
 * the recorded *listing* body, which carries no body field - so the read succeeds and reports an
 * empty message, which the session's verdict pass correctly calls `carriesNothing`. **That is
 * the fixture the `carriesNothing` cases use, and it is the reason a fourth verdict needed no
 * new recorded response anywhere in `packages/providers`.**
 */
export const GUERRILLA_READ_ANSWERS = {
  /** The measured fetch, whose body carries a one-time code. */
  code: guerrillaMessageFetched,
  /** The synthetic fetch, whose body carries an `<a href>` and no code. */
  link: guerrillaMessageWithVerificationLink,
  /** The recorded `500`, so `getMessage` throws and the verdict is `undetermined`. */
  refused: guerrillaUnclassifiable,
} as const satisfies Readonly<Record<string, RecordedStep>>;

/**
 * A recorded **refusal** per creation path, for {@link RecordingOptions.allProvidersThrottled}.
 *
 * **Keyed by the same prefixes as {@link SCRIPT}, deliberately.** A throttle table keyed
 * differently from the script table would let the two drift, and the drift would read as
 * "the refusal path was not exercised" rather than as a broken key.
 */
const REFUSALS: ReadonlyArray<readonly [string, ScriptedResponse]> = [
  [MAILTM_ACCOUNTS, recorded(mailtmThrottled)],
  [GUERRILLA_AJAX, recorded(guerrillaThrottled)],
];

/** One scripted answer. */
interface ScriptedResponse {
  readonly status: number;
  readonly body: string;
}

/**
 * The operations each provider reaches, each answered by its recorded response.
 *
 * **Keyed by the request path the adapter puts in the URL**, which is a spelling this
 * file has to write down and a wire-format question the boundary rule does not ask
 * about. Keying by the *operation name* instead would be worse: Guerrilla Mail carries
 * its operation in a query parameter, so the key would be provider vocabulary in a place
 * a reader would mistake for a path.
 *
 * **Ordered longest-prefix-last on purpose** — the lookup below takes the first match, so
 * `/messages` is written after nothing that could shadow it and must not shadow
 * `/messages/{id}`. **That entry exists now, and it is written before the collection for
 * exactly this reason**: `in-page-fill` opens a message, and with the two the other way round
 * the fetch would have been answered with the *list*, the adapter would have found no member
 * matching the id it asked for, and the case would have failed as *the message could not be
 * read* — which is a sentence about the product and not about the script table.
 *
 * **The id is the recorded one rather than a value typed here**, for the reason the rest of this
 * file imports its fixtures by name: a browser case asserting on `493028` must be asserting on
 * the code a provider actually sent.
 */
const SCRIPT: ReadonlyArray<readonly [string, ScriptedResponse]> = [
  ["https://api.mail.tm/domains", recorded(mailtmDomains)],
  [MAILTM_ACCOUNTS, recorded(mailtmAccountCreated)],
  ["https://api.mail.tm/token", recorded(mailtmToken)],
  [`https://api.mail.tm/messages/${FIXTURE_IDS.mailtm.messageId}`, recorded(mailtmMessageFetched)],
  ["https://api.mail.tm/messages", recorded(mailtmMessageList)],
  [GUERRILLA_AJAX, recorded(guerrillaLiveList)],
];

/**
 * A recorded step, in the shape a route handler can fulfil.
 *
 * **Read off `RecordedStep` rather than re-declared.** `packages/providers`'s recorder
 * types the response as `{status, headers, body}` and this helper takes the two fields a
 * `route.fulfill` needs from it, so a fixture's own status code — `201` for account
 * creation — reaches the browser rather than a `200` this file decided was fine.
 */
function recorded(step: { readonly response: { readonly status: number; readonly body: string } }) {
  return { status: step.response.status, body: step.response.body };
}

/**
 * The recorded values a spec asserts against, re-exported so it reads one source.
 *
 * **`FIXTURE_IDS` is exported by the fixture module precisely so a test does not retype a
 * measured address**, and re-exporting it here rather than importing from two directories
 * in every spec keeps the recorded tier's inputs in one place.
 */
export { FIXTURE_IDS };

/** The recorded session exchange Guerrilla Mail's *creation* call is answered with. */
export const GUERRILLA_SESSION_RESPONSE = guerrillaSessionCreated;

/**
 * The origins this tier scripts a provider for, **derived from {@link SCRIPT}**.
 *
 * ## Why this is exported
 *
 * `manifest.spec.ts` has to answer *"does the extension declare host reach no shipped
 * surface reaches?"* and the honest way to answer it is against the reach a shipped
 * surface **has**, not against a second list of origin strings a spec file typed out.
 * Two lists is two things that can drift, and this repository has already paid for one:
 * `recorded-provider.ts` existed precisely because a spec that transcribed its own
 * fixtures proved the product echoed values the test invented.
 *
 * So the comparison is between the built manifest and **the tier's own script table**.
 * A host permission added for an origin nothing scripts is reach no shipped surface has,
 * and the assertion fires on it by name.
 */
export const SCRIPTED_PROVIDER_ORIGINS: readonly string[] = [
  ...new Set(SCRIPT.map(([prefix]) => new URL(prefix).origin)),
].sort();

export interface RecordingOptions {
  /** Answer Mail.tm with 503 so the fallback path runs. Off by default. */
  readonly mailTmUnavailable?: boolean;

  /**
   * Make **every configured provider refuse** to create a mailbox, each with its own
   * recorded refusal, so the composed refusal a person reads reaches the page at all.
   *
   * **Why "every" is the condition and not a detail.** The extension's manager tries
   * Mail.tm and then Guerrilla Mail, and falls back — a design `provider-abstraction`
   * requires. So throttling one provider reaches the page as **a mailbox created by the
   * other**, which is correct product behaviour and makes this case impossible to stage
   * any other way. What the case establishes is that a refusal reaches the page *when no
   * provider could serve it*, not that either provider refuses.
   *
   * **One is measured and one is synthetic, and the asymmetry matters.** Mail.tm's 429 was
   * observed (`docs/PROVIDERS.md` §3) and its body is the sentence the page must carry
   * verbatim. **Guerrilla Mail was never observed to send a 429** — `fixtures.ts` labels
   * its copy `SYNTHETIC` — so that half stages a second refusal and establishes nothing
   * about that provider. A case reading both bodies as though both were measured would be
   * the same defect as transcribing a fixture into a spec, in the direction where the
   * invented one is the one asserted on.
   *
   * **Only account creation is refused.** `GET /domains` and `POST /token` still succeed,
   * so Mail.tm's 429 answers the request it is actually about rather than being the
   * response to a question that never came up.
   */
  readonly allProvidersThrottled?: boolean;

  /**
   * Awaited before any account-creation request is fulfilled.
   *
   * **Why a gate and not a delay.** A spec that wants "what does the control do while the
   * answer is outstanding" has to reach that state, and a fixed sleep would be a number
   * chosen to be long enough - the recorded defect with a larger constant, recorded again
   * in `AGENTS.md` about `INBOX_POLL_CEILING_MS`. A gate makes the state something the
   * spec *releases*, so the assertions either side of it are both deliberate.
   *
   * **It holds only `/accounts`, not every request.** A gate on the whole route table
   * would also hold the `GET /domains` that precedes creation, and the spec would then be
   * waiting on a request that is not the one under test.
   */
  readonly holdAccountCreation?: Promise<unknown>;

  /**
   * Which recorded fixture answers a **body read** ({@link GUERRILLA_READ_OPERATION}).
   *
   * **Off by default, and the default is a verdict rather than an absence.** With no option the
   * read falls through to {@link SCRIPT} and is answered with the recorded *listing* body,
   * which carries no body field - so the read succeeds, the text is empty, and the session's
   * verdict pass reaches `carriesNothing`. **Stating it as a missing option would have made the
   * most common verdict the one a spec had to opt into by accident.**
   *
   * **The map rather than a fixture argument**, so a spec cannot transcribe a provider body
   * under `apps/` and so the three answers this tier offers are three fixtures that already
   * exist. See {@link GUERRILLA_READ_ANSWERS}.
   */
  readonly guerrillaRead?: (typeof GUERRILLA_READ_ANSWERS)[keyof typeof GUERRILLA_READ_ANSWERS];

  /**
   * The **one-based** attempt at a listing ({@link GUERRILLA_LIST_OPERATION}) from which the
   * recorded `500` is served, so a check that has already succeeded can be made to fail.
   *
   * **Counted rather than a boolean, and the reason is that "the listing fails" is not one
   * moment.** The panel's first listing is its adoption, and a scenario about a *later* check
   * failing - a check that leaves the rows it already learned on screen - cannot be staged by
   * making every listing fail, because then there are no rows to retain. **A spec wanting the
   * first listing itself to fail passes `1`.**
   *
   * **Attempt counting is per `recordProviderTraffic` call**, which is what makes it usable:
   * one spec is one recording, so the counter starts at zero with the panel closed and no two
   * cases in this profile can move it.
   */
  readonly guerrillaListFailsFromAttempt?: number;
}

/** What the interception saw. */
export interface ProviderTraffic {
  /** Every URL the page requested, whatever its origin. */
  readonly requested: readonly string[];
  /**
   * When each of those requests was made, in the same order as {@link ProviderTraffic.requested}.
   *
   * **A log of URLs alone cannot answer "how many times did this happen?", and a spec that
   * asked anyway would be reading its own arithmetic.** The one caller that asked is
   * `background-check.spec.ts`: a wake that listed twice and two wakes that listed once each both
   * produce a log of **two** URLs, and a count that accepts either is not a measurement of a
   * per-wake cost — it is a measurement of a total. Requests made by one iteration of a loop are
   * milliseconds apart; requests made by two iterations of a *timed* loop are a period apart, and
   * **the gap is what separates the two**.
   *
   * **Milliseconds from `Date.now()`, taken at the moment the route handler runs.** That is the
   * instant the request was observed reaching the interceptor, which is early enough to be before
   * any response and late enough to be after the caller's `fetch`. It is not a measure of anything
   * about a provider, and no case asserts an absolute duration against it.
   */
  readonly requestedAt: readonly number[];
  /** Every origin that was requested but had no script, and therefore was aborted. */
  readonly unscripted: readonly string[];
}

/**
 * Intercept provider traffic, and report what was asked for.
 *
 * **Returns the live arrays rather than a snapshot**, because a spec has to read what
 * was requested *after* the interaction that caused it.
 */
export async function recordProviderTraffic(
  context: BrowserContext,
  options: RecordingOptions = {},
): Promise<ProviderTraffic> {
  const requested: string[] = [];
  const requestedAt: number[] = [];
  const unscripted: string[] = [];

  /**
   * How many listings this recording has answered, so a *later* one can be made to fail.
   *
   * **A closure counter rather than a member of {@link ProviderTraffic}, and the reason is that
   * nothing outside this function may read it.** Exposing it would invite a spec to assert on
   * the count as though it were a property of the product; it is a property of the staging, and
   * the only claim a spec makes about it is whether the listing it staged arrived.
   */
  let listingAttempts = 0;

  await context.route("**/*", async (route) => {
    const url = route.request().url();

    // **Non-provider requests are passed through untouched** — the popup's own
    // `chrome-extension://` document, its script, its stylesheet. Routing those would
    // mean answering them, and the suite's subject is not the popup's own assets.
    if (!url.startsWith("https://")) {
      await route.continue();
      return;
    }

    requested.push(url);
    requestedAt.push(Date.now());

    if (options.mailTmUnavailable && url.startsWith("https://api.mail.tm")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return;
    }

    // **The gate, and it is released by the spec rather than waited for.** `push` has already
    // happened by the time this runs, so a spec that wants to know whether the request was
    // *made* — rather than merely scripted — reads `requested` while the gate is still
    // shut. That is what lets a case hold a request open and still assert on it.
    if (options.holdAccountCreation !== undefined && url.startsWith(MAILTM_ACCOUNTS)) {
      await options.holdAccountCreation;
    }

    if (options.allProvidersThrottled) {
      const refusal = REFUSALS.find(([prefix]) => url.startsWith(prefix));
      if (refusal !== undefined) {
        await route.fulfill({
          status: refusal[1].status,
          contentType: "text/plain",
          body: refusal[1].body,
        });
        return;
      }
    }

    /**
     * **Guerrilla Mail's two operations are told apart before {@link SCRIPT} is consulted, and
     * that ordering is the whole seam.** {@link SCRIPT} keys on a URL *prefix*, and
     * `ajax.php` is the prefix of both operations - so without this block a body read would be
     * answered with a *listing*, the adapter would find no body field, and every staged verdict
     * would be `carriesNothing` while the spec believed it had staged something else.
     *
     * **Both branches are no-ops unless a spec asked for them**, so every case in this file that
     * does not opt in is answered exactly as it was before this seam existed. That is the
     * direction that matters: a seam that changed the default would have invalidated the 82
     * cases already passing rather than the seven this change adds.
     */
    if (url.startsWith(GUERRILLA_AJAX)) {
      const operation = new URL(url).searchParams.get(GUERRILLA_OPERATION_PARAMETER);

      if (operation === GUERRILLA_READ_OPERATION && options.guerrillaRead !== undefined) {
        const staged = recorded(options.guerrillaRead);
        await route.fulfill({
          status: staged.status,
          contentType: "application/json",
          body: staged.body,
        });
        return;
      }

      if (operation === GUERRILLA_LIST_OPERATION) {
        listingAttempts += 1;

        if (
          options.guerrillaListFailsFromAttempt !== undefined &&
          listingAttempts >= options.guerrillaListFailsFromAttempt
        ) {
          const refused = recorded(guerrillaUnclassifiable);
          await route.fulfill({
            status: refused.status,
            contentType: "text/plain",
            body: refused.body,
          });
          return;
        }
      }
    }

    const match = SCRIPT.find(([prefix]) => url.startsWith(prefix));
    if (match === undefined) {
      // **Named, not silently dropped.** An origin nobody scripted is either a new
      // provider or a bug; either a way to catch it is to print it.
      const origin = new URL(url).origin;
      if (!unscripted.includes(origin)) unscripted.push(origin);
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      status: match[1].status,
      contentType: "application/json",
      body: match[1].body,
    });
  });

  return {
    get requested() {
      return requested;
    },
    get requestedAt() {
      return requestedAt;
    },
    get unscripted() {
      return unscripted;
    },
  };
}
