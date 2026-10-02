/**
 * Recorded provider responses.
 *
 * Every fixture here is a real response captured by the M0 spike against a live
 * provider. Where a recording is **synthetic** it is labelled `SYNTHETIC` in a
 * comment on the fixture itself, because the point is to exercise *our* mapping of
 * a condition rather than to assert the provider produces it.
 *
 * Provenance matters here more than usual. A fixture that quietly stopped
 * resembling the provider would make the conformance suite green and wrong, which
 * is the failure mode this file exists to prevent.
 *
 * @module
 */

import type { RecordedStep } from "./recorder";
import { jsonResponse, textResponse, withHeaders } from "./recorder";

/* -- Mail.tm ---------------------------------------------------------------- */

const MAILTM_TOKEN = "eyJhbGciOiJIUzI1NiJ9.measured-jwt-shape";
const MAILTM_ADDRESS = "quiet-brook-7741@uberip.com";
const MAILTM_ACCOUNT_ID = "/accounts/0f3c9a52-1c8e-4f0b-9a7d-2b6e5c4a1f30";
const MAILTM_RESOURCE_URL = `https://api.mail.tm${MAILTM_ACCOUNT_ID}`;
const MAILTM_MESSAGE_ID = "9a1d5e7c-3b2f-4a8e-8c6d-1f0e9b8a7c6d";

/**
 * MEASURED. `GET /domains?page=1` — `200`, one active domain, hydra collection.
 */
export const mailtmDomains: RecordedStep = {
  response: jsonResponse({
    "@context": "/contexts/Domain",
    "@id": "/domains/1",
    "@type": "Collection",
    "hydra:member": [
      { "@id": "/domains/1", "@type": "Domain", domain: "uberip.com", isActive: true },
    ],
    "hydra:totalItems": 1,
  }),
};

/**
 * MEASURED. `POST /accounts` — `201`, resource URL in a **relative** `@id`.
 *
 * The relative form is the whole reason deletion must follow this value rather
 * than construct `/accounts/{id}` itself.
 */
export const mailtmAccountCreated: RecordedStep = {
  response: jsonResponse(
    {
      "@id": MAILTM_ACCOUNT_ID,
      "@type": "Account",
      id: MAILTM_ACCOUNT_ID.split("/").pop(),
      address: MAILTM_ADDRESS,
      quota: 40_000_000,
    },
    201,
  ),
};

/** MEASURED. `POST /token` — `200`, a bearer token. */
export const mailtmToken: RecordedStep = {
  response: jsonResponse({ token: MAILTM_TOKEN }),
};

/**
 * MEASURED. `GET /messages?page=1` — a hydra collection whose one member carries
 * `text` alongside `html`, and whose `seen` is the provider's inverse of `unread`.
 *
 * The empty subject is not a typo: a real delivered message arrived with an empty
 * subject while its sender and body were both present (run
 * `2026-10-01T18-08-41-251Z`).
 */
export const mailtmMessageList: RecordedStep = {
  response: jsonResponse({
    "@context": "/contexts/Message",
    "@id": "/messages/1",
    "@type": "Collection",
    "hydra:member": [
      {
        "@id": `/messages/${MAILTM_MESSAGE_ID}`,
        "@type": "Message",
        id: MAILTM_MESSAGE_ID,
        msgid: "measured-msgid@uberip.com",
        from: { "@type": "MessageSender", address: "noreply@uberip.com", name: "Uber" },
        to: [{ "@type": "Recipient", address: MAILTM_ADDRESS }],
        subject: "",
        intro: "Your verification code",
        seen: false,
        flagged: false,
        createdAt: "2026-10-01T18:08:41Z",
        updatedAt: "2026-10-01T18:08:41Z",
        text: "Your verification code is 493028. It expires in 10 minutes.",
        html: ["<p>Your verification code is <b>493028</b>. It expires in 10 minutes.</p>"],
        attachments: [],
      },
    ],
    "hydra:totalItems": 1,
  }),
};

/** MEASURED. `GET /messages/{id}` — `200`, full body. */
export const mailtmMessageFetched: RecordedStep = {
  response: jsonResponse({
    "@id": `/messages/${MAILTM_MESSAGE_ID}`,
    "@type": "Message",
    id: MAILTM_MESSAGE_ID,
    from: { address: "noreply@uberip.com", name: "Uber" },
    subject: "",
    createdAt: "2026-10-01T18:08:41Z",
    seen: false,
    text: "Your verification code is 493028. It expires in 10 minutes.",
    html: ["<p>Your verification code is <b>493028</b>. It expires in 10 minutes.</p>"],
  }),
};

/** MEASURED. `DELETE /accounts/{id}` — `204`, no body. */
export const mailtmDeleted: RecordedStep = {
  response: { status: 204, headers: {}, body: "" },
};

/**
 * MEASURED. `POST /accounts` when throttled — `429` carrying
 * `ratelimit-policy: 1; w=60`.
 *
 * The header states a limit and a window and **nothing about what it is per**.
 * "Per IP" is an inference from how such headers usually work, and it is
 * deliberately absent from this product.
 */
export const mailtmThrottled: RecordedStep = {
  response: withHeaders(
    textResponse("Too many accounts created. Please wait and try again.", 429),
    { "ratelimit-policy": "1; w=60" },
  ),
};

/** MEASURED. `POST /token` with wrong credentials — `401 "Invalid credentials."` */
export const mailtmBadCredentials: RecordedStep = {
  response: jsonResponse(
    { "hydra:title": "An error occurred", "hydra:description": "Invalid credentials." },
    401,
  ),
};

/** MEASURED. `GET /messages/{uuid-zero}` — `404`, hydra error. */
export const mailtmUnknownMessage: RecordedStep = {
  response: jsonResponse(
    { "hydra:title": "An error occurred", "hydra:description": "Not Found" },
    404,
  ),
};

/**
 * MEASURED. `POST /accounts` with a rejected address — `422`
 * `ConstraintViolationList`.
 */
export const mailtmValidationFailure: RecordedStep = {
  response: jsonResponse(
    {
      "@context": "/contexts/ConstraintViolationList",
      "@type": "ConstraintViolationList",
      "hydra:title": "An error occurred",
      "hydra:description": "address: This value is not a valid email address.",
      violations: [
        { propertyPath: "address", message: "This value is not a valid email address." },
      ],
    },
    422,
  ),
};

/**
 * MEASURED. `GET /me` after deletion — `401`.
 *
 * This is how Mail.tm says a mailbox is gone: the token is invalidated by
 * deletion, so the next authenticated request is refused with no further detail.
 */
export const mailtmGoneAfterDelete: RecordedStep = {
  response: jsonResponse(
    { "hydra:title": "An error occurred", "hydra:description": "Unauthorized" },
    401,
  ),
};

/** SYNTHETIC. A `500` nobody has observed, to exercise the unclassified path. */
export const mailtmUnclassifiable: RecordedStep = {
  response: textResponse("Internal Server Error", 500),
};

/* -- Guerrilla Mail --------------------------------------------------------- */

const GUERRILLA_SESSION = "measured-sid-token";
const GUERRILLA_ADDRESS = "randomuser123456@sharklasers.com";

/**
 * MEASURED. `GET ajax.php?f=get_email_address` — `200`, address plus session
 * token in the body.
 *
 * The provider also sets `PHPSESSID`, but `Access-Control-Allow-Origin: *` with
 * no `Access-Control-Allow-Credentials` means a browser refuses to send it
 * cross-origin. The body token is the only carrier that works from a web page,
 * which is the only environment the website runs in.
 */
export const guerrillaSessionCreated: RecordedStep = {
  response: withHeaders(
    jsonResponse({
      email_addr: GUERRILLA_ADDRESS,
      sid_token: GUERRILLA_SESSION,
      auth: { success: true, session_id: "measured-php-session" },
      _t: 1759343721,
    }),
    {
      "access-control-allow-origin": "*",
      "set-cookie": "PHPSESSID=measured-php-session; domain=.api.guerrillamail.com",
    },
  ),
};

/**
 * MEASURED. `f=check_email` with a **live** session — `200`, one message, empty
 * subject, and the session's own address echoed back.
 *
 * The echoed address is the only evidence available that the session is alive.
 */
export const guerrillaLiveList: RecordedStep = {
  response: jsonResponse({
    email_addr: GUERRILLA_ADDRESS,
    sid_token: GUERRILLA_SESSION,
    list: [
      {
        mail_id: 1_000_000,
        mail_from: "sender@example.invalid",
        mail_recipient: GUERRILLA_ADDRESS,
        mail_subject: "",
        mail_date: "2026-10-01",
        mail_time: "18:08:41",
        mail_read: "0",
        mail_excerpt: "Your verification code is 493028",
      },
    ],
  }),
};

/**
 * MEASURED. `f=fetch_email` — `200`, with `content_type: "text"` and an **HTML**
 * body.
 *
 * The declared type and the actual content disagree. This is the recorded
 * evidence for why the declared type is never read, and for why no markup field
 * exists on the message: there is nothing trustworthy to mark the body with.
 */
export const guerrillaMessageFetched: RecordedStep = {
  response: jsonResponse({
    mail_id: 1_000_000,
    mail_from: "sender@example.invalid",
    mail_recipient: GUERRILLA_ADDRESS,
    mail_subject: "",
    mail_date: "2026-10-01",
    mail_time: "18:08:41",
    content_type: "text",
    mail_size: 1042,
    mail_body:
      "<pre>Dear Random User, Thank you for using Guerrilla Mail\n\nYour code is 493028</pre>",
  }),
};

/**
 * MEASURED. `f=check_email` with an **unrecognised** session — `HTTP 200`, an
 * empty list, no `error`, and `auth.success` still `true`.
 *
 * This is the data-loss trap. Dead and empty are the same response, so an adapter
 * that returns the list directly tells a user their mailbox has no mail when in
 * fact the mailbox is unusable. The `email_addr` is deliberately absent here,
 * which is the signal the adapter checks.
 */
export const guerrillaDeadSession: RecordedStep = {
  response: jsonResponse({
    sid_token: GUERRILLA_SESSION,
    auth: { success: true, session_id: "expired" },
  }),
};

/** SYNTHETIC. A `429`, which Guerrilla was never observed to send. */
export const guerrillaThrottled: RecordedStep = {
  response: withHeaders(textResponse("Too Many Requests", 429), {
    "ratelimit-policy": "100; w=60",
  }),
};

/** SYNTHETIC. A `500`, which Guerrilla was never observed to send. */
export const guerrillaUnclassifiable: RecordedStep = {
  response: textResponse("Internal Server Error", 500),
};

/** Identifiers the fixtures above were built around, for tests that need them. */
export const FIXTURE_IDS = {
  mailtm: {
    address: MAILTM_ADDRESS,
    accountId: MAILTM_ACCOUNT_ID,
    resourceUrl: MAILTM_RESOURCE_URL,
    token: MAILTM_TOKEN,
    messageId: MAILTM_MESSAGE_ID,
  },
  guerrilla: {
    address: GUERRILLA_ADDRESS,
    sessionId: GUERRILLA_SESSION,
    messageId: "1000000",
  },
} as const;
