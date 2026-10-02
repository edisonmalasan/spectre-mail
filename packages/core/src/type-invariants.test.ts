/**
 * Compile-time invariants.
 *
 * Everything asserted here is checked by `tsc --noEmit` when the package
 * typechecks, not by the runtime `it` at the bottom. These are properties of the
 * *types*, and a runtime test cannot observe them at all.
 *
 * The negative half of each property — that the illegal version genuinely fails
 * to compile — cannot live in a file that must itself compile. Those proofs run
 * separately by introducing the violation and observing a non-zero exit; see
 * `tasks.md` in the `shared-domain-model` change for the recorded results. A check
 * that cannot fail is documentation with extra steps, which is the failure mode
 * this repository has now hit three times.
 *
 * Values are real object literals rather than `declare const`, because anything
 * `declare`d does not exist at runtime and referencing it here would throw.
 */

import { describe, expect, it } from "vitest";

import { assertGuerrillaCredentials, assertMailTmCredentials } from "./credentials";
import type { GuerrillaCredentials, MailTmCredentials } from "./credentials";
import type { AssertProviderAgreement } from "./invariants";
import { createMailbox } from "./mailbox";
import type { Mailbox } from "./mailbox";
import type { Message, VerificationCode, VerificationLink } from "./message";

const mailTm: MailTmCredentials = {
  provider: "mailtm",
  accountId: "acct-1",
  accessToken: "token-value",
};

const guerrilla: GuerrillaCredentials = {
  provider: "guerrilla",
  sessionId: "session-value",
};

/* -- credentials: the union is discriminated, so each variant narrows -- */

const asUnion: MailTmCredentials | GuerrillaCredentials = mailTm;
const unionMembers: readonly (MailTmCredentials | GuerrillaCredentials)[] = [mailTm, guerrilla];

/* -- narrowing yields the specific variant, with its own fields -- */

const narrowedByMailTm = assertMailTmCredentials(mailTm);
const narrowedToken: string = narrowedByMailTm.accessToken;
const narrowedAccount: string = narrowedByMailTm.accountId;

const narrowedByGuerrilla = assertGuerrillaCredentials(guerrilla);
const narrowedSession: string = narrowedByGuerrilla.sessionId;

/* -- mailbox agreement resolves to the mailbox itself, not to never -- */

// If `AssertProviderAgreement` resolved to `never` for a well-formed mailbox,
// every mailbox would fail to typecheck. This line compiling *is* the assertion -
// it is the exact check that a non-generic version of this type silently failed.
const constructed: AssertProviderAgreement<Mailbox> = createMailbox({
  id: "mailbox-1",
  address: "someone@sharklasers.com",
  createdAt: 1_700_000_000_000,
  credentials: mailTm,
});

// Applied to a value whose provider is pinned, the assertion also narrows, so
// downstream code knows which provider it is holding.
const pinned = { provider: "mailtm", credentials: mailTm } as const;
const pinnedAgreement: AssertProviderAgreement<typeof pinned> = pinned;
const derivedProvider: "mailtm" = pinnedAgreement.provider;

/* -- confidence is a plain number, deliberately unbranded -- */

const code: VerificationCode = { value: "123456", confidence: 0.9 };
const link: VerificationLink = {
  url: "https://example.com/verify",
  hostname: "example.com",
  confidence: 1,
};

const score: number = code.confidence + link.confidence;

/* -- the message type carries one text body and no markup field -- */

const message: Message = {
  id: "message-1",
  mailboxId: "mailbox-1",
  from: "sender@example.com",
  subject: "",
  receivedAt: 1_700_000_100_000,
  text: "<p>Your code is <b>123456</b></p>",
  verificationCodes: [code],
  verificationLinks: [link],
};

describe("compile-time invariants", () => {
  it("holds together at runtime", () => {
    // The type assertions above are verified by `pnpm typecheck`. This test exists
    // so the file is a real suite rather than one with no tests, which Vitest
    // rejects. It touches each assertion so none can be deleted silently.
    expect([
      asUnion,
      unionMembers,
      narrowedToken,
      narrowedAccount,
      narrowedSession,
      derivedProvider,
      score,
      message.text,
      constructed.id,
    ]).toHaveLength(9);
  });

  it("keeps an empty subject representable on a full message", () => {
    expect(message.subject).toBe("");
    expect(message.verificationCodes[0]?.value).toBe("123456");
  });
});
