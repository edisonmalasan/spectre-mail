# `apps/extension`

The SpectreMail Chromium extension: a disposable address, the mail that arrives in it, and
the code that mail carries, reachable without leaving the page you are on.

**This file described a placeholder for four milestones after the placeholder was gone.**
It said the directory contained no extension, no `manifest.json`, no service worker and no
build step — all true at M1 and all false since M8. What is here now is a Manifest V3
client with four entry points, its own build, and a browser suite that loads it unpacked.

## Entry points

| Entry          | Source                  | What it does                                                                                     |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Service worker | `src/service-worker.ts` | Every provider request, the alarm that polls, and the notification it raises                     |
| Content script | `src/content-script/`   | Offers the address in a shadow root inside somebody else's page, and fills a one-time-code field |
| Popup          | `src/main.tsx`          | Creates or shows the address, lists the mail, opens a message, and asks for a fill               |
| Side panel     | `src/panel-main.tsx`    | The same session beside the page, naming the host it is beside and offering a held mailbox       |

The manifest declares `storage`, `alarms`, `notifications` and `sidePanel`, plus wildcard
host permissions for both providers. **`tabs` is deliberately absent** — `chrome.tabs.query`
and `chrome.tabs.sendMessage` need none, measured — and
`e2e/manifest.spec.ts` holds a permission map asserted in both directions, so a declared
permission with nothing behind it fails as well as a call with no permission.

## Build and load

```bash
pnpm --filter @spectre-mail/extension build
```

That is **two** `vite` builds and neither is optional: the popup, the side panel and the
service worker first, then the content script, which Chromium loads as a single classic
script. The first config sets `emptyOutDir: false` so the second does not erase the first's
output — so **no build removes a stale artefact**, and `pnpm test:browser` is the one command
that deletes `dist/` first.

Load `apps/extension/dist` as an unpacked extension. There is no dev server, no packaged
release and no store listing: **nothing is published**, and `docs/ROADMAP.md` §33.2 records
that as an unmet criterion rather than a completed one.

## Rules that apply here

1. **No provider wire format.** The extension reaches providers through
   `@spectre-mail/providers`. A provider JSON field name fails the build.
2. **Mail.tm is primary, Guerrilla Mail is fallback** for this client, per
   `openspec/specs/provider-abstraction/spec.md`. The website's single-provider setup is not
   this client's setup.
3. **Host permissions use the wildcard path form.** `https://api.mail.tm/*` is required;
   `https://api.mail.tm` silently grants nothing. This is measured — see
   `docs/PROVIDERS.md` §2 — and the built manifest is read back in a browser case.
4. **The platform global is reached in one module**, `src/extension-platform.ts`, which reads
   `chrome` reflectively. A second module naming it fails the build.
5. **Reusable logic goes in `packages/`**, never here and never in `apps/web`. Enforced by
   `tests/architecture/boundaries.test.ts`.
6. **The content script is not a second network client.** A content script's `fetch` obeys
   the **page's** CORS policy while host permissions do not reach it, so provider work is
   delegated to the service worker and the provider is contacted from one context.

## Verification

- `pnpm test` — the unit tier, `apps/extension/src`: **490 tests across 22 files**.
- `pnpm test:browser` — **98 cases across 10 spec files**, against the **built** `dist` loaded
  unpacked in real Chromium. Both `--load-extension` and `--disable-extensions-except` are
  required, with an absolute path; every other combination loads nothing and reports no
  error, which is why `playwright.config.ts` exports one helper rather than each spec
  spelling the flags.

**Nothing about how it looks has been verified**, and nothing about a live provider: every
provider response in both tiers is a recorded one. A notification's registration is
measured; a person _seeing_ one is not. The live host-permission check exists as a
quarantined instrument and **no result is claimed for it** — see the root `README.md`'s
"Deferred verification" section.
