import { describe, expect, it } from "vitest";

import type { ProviderCredentials } from "./credentials";
import { isMailbox } from "./invariants";
import { createMailbox, isMailboxGone, withMailboxStatus } from "./mailbox";
import type { MailboxInit } from "./mailbox";

const mailTmCredentials: ProviderCredentials = {
  provider: "mailtm",
  accountId: "acct-1",
  accessToken: "token-value",
};

const guerrillaCredentials: ProviderCredentials = {
  provider: "guerrilla",
  sessionId: "session-value",
};

function init(overrides: Partial<MailboxInit> = {}): MailboxInit {
  return {
    id: "mailbox-1",
    address: "someone@sharklasers.com",
    createdAt: 1_700_000_000_000,
    credentials: mailTmCredentials,
    ...overrides,
  };
}

describe("createMailbox", () => {
  it("derives the provider from the credentials rather than accepting one", () => {
    // The roadmap's Mailbox shape carries both `provider` and `credentials` with
    // nothing correlating them. Deriving one from the other is what stops the
    // mismatch; note the caller cannot supply `provider` at all.
    expect(createMailbox(init()).provider).toBe("mailtm");
    expect(createMailbox(init({ credentials: guerrillaCredentials })).provider).toBe("guerrilla");
  });

  it("starts active, because a new mailbox has not been observed to fail", () => {
    expect(createMailbox(init()).status).toBe("active");
  });

  it("carries the supplied fields unchanged", () => {
    const mailbox = createMailbox(init());
    expect(mailbox.id).toBe("mailbox-1");
    expect(mailbox.address).toBe("someone@sharklasers.com");
    expect(mailbox.createdAt).toBe(1_700_000_000_000);
    expect(mailbox.credentials).toBe(mailTmCredentials);
  });

  it("leaves expiresAt absent when no signal was observed", () => {
    // Absence is the normal case, not an oversight: no provider reports a mailbox
    // lifetime in any API response, so any expiresAt SpectreMail holds would be one
    // it observed. The key must be absent, not present-and-undefined.
    const mailbox = createMailbox(init());
    expect("expiresAt" in mailbox).toBe(false);
  });

  it("keeps an observed expiresAt", () => {
    const mailbox = createMailbox(init({ expiresAt: 1_700_003_600_000 }));
    expect(mailbox.expiresAt).toBe(1_700_003_600_000);
  });
});

describe("mailbox provider agreement", () => {
  it("holds for every mailbox the constructor produces", () => {
    const mailboxes = [
      createMailbox(init({ credentials: mailTmCredentials })),
      createMailbox(init({ credentials: guerrillaCredentials })),
    ];

    for (const mailbox of mailboxes) {
      expect(mailbox.provider).toBe(mailbox.credentials.provider);
    }
  });

  it("rejects a hand-built mailbox whose provider contradicts its credentials", () => {
    // The type-level assertion covers typed code; `isMailbox` covers the boundary
    // where untrusted data enters — a record read from storage, or handed over by a
    // provider. Both are needed: neither substitutes for the other.
    const mismatched = {
      id: "mailbox-1",
      provider: "guerrilla",
      address: "someone@sharklasers.com",
      createdAt: 1_700_000_000_000,
      credentials: mailTmCredentials,
      status: "active",
    };

    expect(isMailbox(mismatched)).toBe(false);
  });

  it("accepts a hand-built mailbox that agrees", () => {
    const agreeing = {
      id: "mailbox-1",
      provider: "mailtm",
      address: "someone@sharklasers.com",
      createdAt: 1_700_000_000_000,
      credentials: mailTmCredentials,
      status: "active",
    };

    expect(isMailbox(agreeing)).toBe(true);
  });

  it("rejects a mailbox that is not a mailbox at all", () => {
    expect(isMailbox(null)).toBe(false);
    expect(isMailbox(undefined)).toBe(false);
    expect(isMailbox("mailbox-1")).toBe(false);
    expect(isMailbox({})).toBe(false);
  });

  it("rejects an unknown status rather than defaulting it", () => {
    const bad = {
      id: "mailbox-1",
      provider: "mailtm",
      address: "someone@sharklasers.com",
      createdAt: 1_700_000_000_000,
      credentials: mailTmCredentials,
      status: "half-expired",
    };

    expect(isMailbox(bad)).toBe(false);
  });

  it("rejects an unknown provider rather than coercing it", () => {
    const bad = {
      id: "mailbox-1",
      provider: "protonmail",
      address: "someone@protonmail.com",
      createdAt: 1_700_000_000_000,
      credentials: { provider: "protonmail", token: "x" },
      status: "active",
    };

    expect(isMailbox(bad)).toBe(false);
  });

  it("requires the credential fields the variant promises", () => {
    const missingToken = {
      id: "mailbox-1",
      provider: "mailtm",
      address: "someone@sharklasers.com",
      createdAt: 1_700_000_000_000,
      credentials: { provider: "mailtm", accountId: "acct-1" },
      status: "active",
    };

    expect(isMailbox(missingToken)).toBe(false);
  });

  it("accepts a stored mailbox carrying an observed expiry", () => {
    const withExpiry = {
      ...createMailbox(init({ expiresAt: 1_700_003_600_000 })),
    };

    expect(isMailbox(withExpiry)).toBe(true);
    expect(isMailbox(createMailbox(init()))).toBe(true);
  });
});

describe("withMailboxStatus", () => {
  it("records an observed transition without inventing a time", () => {
    // No elapsed timestamp and no expiry is written here. `expiresAt` is only ever
    // set from a provider signal, so a status change must not smuggle one in.
    const mailbox = createMailbox(init({ expiresAt: 1_700_003_600_000 }));
    const expired = withMailboxStatus(mailbox, "expired");

    expect(expired.status).toBe("expired");
    expect(expired.expiresAt).toBe(1_700_003_600_000);
    expect(expired.createdAt).toBe(mailbox.createdAt);
    expect(mailbox.status).toBe("active");
  });

  it("treats only an observed expiry as gone", () => {
    const mailbox = createMailbox(init());

    expect(isMailboxGone(withMailboxStatus(mailbox, "expired"))).toBe(true);
    // Unreachable is not gone. Conflating them would tell a user their mailbox was
    // destroyed when the provider was merely not answering.
    expect(isMailboxGone(withMailboxStatus(mailbox, "unavailable"))).toBe(false);
    expect(isMailboxGone(mailbox)).toBe(false);
  });
});
