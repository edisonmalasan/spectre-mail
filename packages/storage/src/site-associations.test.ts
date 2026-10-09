/**
 * `createChromeSiteAssociations`, over a fake `chrome.storage.local` area.
 *
 * ## What is being tested is narrower than it looks
 *
 * A map is a map, so most of these cases would pass against any implementation that stored one. The
 * three that matter are the ones about **identity**: that a key is the host as given and not a
 * derived one, that an unrecorded host is an absence rather than a failure, and that a record this
 * build cannot read is neither answered from nor replaced.
 *
 * ## No hostname validation, and the test that says so
 *
 * `readStoredSiteAssociations` accepts any string key. That is a decision (`site-associations.ts`
 * gives the reason: a host pattern this product cannot write correctly would drop real associations
 * while looking like the narrowing that protects them), and a decision with no test is a decision
 * that gets reversed by the next person who sees it as an oversight. So the case below plants keys
 * that a naive host pattern would reject, and requires them back.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { createChromeSiteAssociations, EXTENSION_SITE_MAILBOXES_KEY } from "./chrome";
import { fakeChromeArea } from "./testing/chrome-area";
import { SPECTRE_ENVELOPE_VERSION, toStoredSiteAssociations } from "./record";

describe("createChromeSiteAssociations", () => {
  it("records a host and answers it without reading the whole record", async () => {
    const { area, calls } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    await sites.saveSiteMailboxId("mail.example", "session-1");

    await expect(sites.loadSiteMailboxId("mail.example")).resolves.toBe("session-1");
    // **One key asked for, never `undefined`.** Asking for the whole area would hand a content
    // script every host this device has visited, on somebody else's page, to answer one question.
    expect(calls.filter((call) => call.startsWith("get("))).toEqual([
      "get(site-mailboxes)",
      "get(site-mailboxes)",
    ]);
  });

  it("reports an unrecorded host as an absence rather than a failure", async () => {
    const { area } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    await sites.saveSiteMailboxId("mail.example", "session-1");

    // **Two absences, and they are not the same.** Nothing stored at all, and nothing stored for
    // *this* host, both answer `null` — and neither is a rejection, because a rejection would tell
    // a client its storage is broken when it is only empty.
    await expect(sites.loadSiteMailboxId("other.example")).resolves.toBeNull();
    await expect(
      createChromeSiteAssociations({ area: fakeChromeArea().area }).loadSiteMailboxId(
        "mail.example",
      ),
    ).resolves.toBeNull();
  });

  it("reports a read failure as a failure rather than as no association", async () => {
    const failing = fakeChromeArea();
    failing.area.get = () => Promise.reject(new Error("quota"));

    await expect(
      createChromeSiteAssociations({ area: failing.area }).loadSiteMailboxId("mail.example"),
    ).rejects.toThrow(/quota/);
  });

  it("answers null for a host whose entry it cannot read, without failing the read", async () => {
    const { area } = fakeChromeArea({
      [EXTENSION_SITE_MAILBOXES_KEY]: {
        version: SPECTRE_ENVELOPE_VERSION,
        sites: { "mail.example": "session-1", "broken.example": 42 },
      },
    });

    // **An unreadable entry is skipped, and the rest of the record still answers.** One bad entry
    // must not make every host unreadable — and the read is not a failure, because the platform
    // did return the record.
    const sites = createChromeSiteAssociations({ area });
    await expect(sites.loadSiteMailboxId("mail.example")).resolves.toBe("session-1");
    await expect(sites.loadSiteMailboxId("broken.example")).resolves.toBeNull();
  });

  it("keeps two hosts that share a parent domain apart", async () => {
    const { area } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    await sites.saveSiteMailboxId("login.example.co.uk", "session-1");
    await sites.saveSiteMailboxId("example.co.uk", "session-2");

    // **The roadmap's mapping is `hostname -> mailbox ID`, and this is what "hostname" has to
    // mean for it to be worth storing.** Folding these together needs a public suffix list this
    // product does not ship, and guessing one from the last two labels would merge a login page
    // into an unrelated site — which the person who hit it cannot undo.
    await expect(sites.loadSiteMailboxId("login.example.co.uk")).resolves.toBe("session-1");
    await expect(sites.loadSiteMailboxId("example.co.uk")).resolves.toBe("session-2");
  });

  it("replaces the association when a host is used with a different mailbox", async () => {
    const { area } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    await sites.saveSiteMailboxId("mail.example", "session-1");
    await sites.saveSiteMailboxId("mail.example", "session-2");

    // **"Last used with" is one answer per host**, so a second recording replaces the first rather
    // than growing a list the contract does not describe.
    await expect(sites.loadSiteMailboxId("mail.example")).resolves.toBe("session-2");
  });

  it("keeps a key it cannot read out of the answer and out of the record", async () => {
    const stored = {
      version: SPECTRE_ENVELOPE_VERSION,
      sites: { "mail.example": "session-1", "other.example": 42, "empty.example": "" },
    };
    const { area, data } = fakeChromeArea({ [EXTENSION_SITE_MAILBOXES_KEY]: stored });
    const sites = createChromeSiteAssociations({ area });

    await expect(sites.loadSiteMailboxId("mail.example")).resolves.toBe("session-1");
    await expect(sites.loadSiteMailboxId("other.example")).resolves.toBeNull();

    // **Skipped, not deleted.** A value this build cannot read is left where it is; removing it on
    // a failed narrow is the irreversible loss the mailbox narrowing refuses to perform.
    await sites.saveSiteMailboxId("third.example", "session-3");
    expect(
      (data[EXTENSION_SITE_MAILBOXES_KEY] as { sites: Record<string, unknown> }).sites[
        "other.example"
      ],
    ).toBe(42);
  });

  it("answers for keys a host pattern would reject, because the platform's spelling is the key", async () => {
    const { area } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    // **An IPv6 literal, a punycode host, and a port the platform did not report.** None of these
    // is rejected, and that is the point: a rule for what a host looks like is a rule this product
    // cannot write correctly, and a wrong one drops real associations while looking protective.
    await sites.saveSiteMailboxId("[::1]", "session-1");
    await sites.saveSiteMailboxId("xn--bcher-kva.example", "session-2");

    await expect(sites.loadSiteMailboxId("[::1]")).resolves.toBe("session-1");
    await expect(sites.loadSiteMailboxId("xn--bcher-kva.example")).resolves.toBe("session-2");
  });

  it("refuses an empty host or an empty mailbox id, and stores nothing", async () => {
    const { area, data } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    await expect(sites.saveSiteMailboxId("", "session-1")).rejects.toThrow(TypeError);
    await expect(sites.saveSiteMailboxId("mail.example", "")).rejects.toThrow(TypeError);
    expect(data[EXTENSION_SITE_MAILBOXES_KEY]).toBeUndefined();
  });

  it("leaves a record it cannot read in place rather than replacing it", async () => {
    const unreadable = { version: 99, sites: { "mail.example": "session-1" } };
    const { area, data } = fakeChromeArea({ [EXTENSION_SITE_MAILBOXES_KEY]: unreadable });
    const sites = createChromeSiteAssociations({ area });

    // **And a read refuses rather than answering "no association".** The two would look identical
    // to a caller, and the difference is the whole reason `null` is reserved for one meaning in
    // this layer: "nothing is recorded" and "this cannot be read" lead to different correct actions.
    await expect(sites.loadSiteMailboxId("mail.example")).rejects.toThrow(/could not be read/);
    await expect(sites.saveSiteMailboxId("mail.example", "session-2")).rejects.toThrow(
      /could not be read/,
    );
    expect(data[EXTENSION_SITE_MAILBOXES_KEY]).toEqual(unreadable);
  });

  it("writes the record in the shape its own reader accepts", async () => {
    const { area, data } = fakeChromeArea();
    const sites = createChromeSiteAssociations({ area });

    await sites.saveSiteMailboxId("mail.example", "session-1");

    expect(data[EXTENSION_SITE_MAILBOXES_KEY]).toEqual(
      toStoredSiteAssociations({ "mail.example": "session-1" }),
    );
  });
});
