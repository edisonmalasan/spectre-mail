# `apps/extension` — placeholder

**This directory contains no extension.** That is deliberate, and it is the
correct state for milestone M1.

## What is not here, and why

| Missing               | Why                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`       | The roadmap schedules the extension build for **M8**. A manifest with placeholder permissions would look like a working extension, and host permissions are exactly where M0 measured a silent-failure trap. An absent manifest cannot mislead. |
| Service worker        | MV3 background logic depends on the provider layer (**M3**).                                                                                                                                                                                    |
| Popup / side panel UI | M9–M11, and visual work starts at M7.                                                                                                                                                                                                           |
| Any provider call     | The provider layer is M3. This client will consume `@spectre-mail/providers` through the shared abstraction, never directly.                                                                                                                    |

The directory is a workspace member so it is structurally present, type checked,
and visible to the architecture boundary test. It contributes no build output.

## Why extension work is not first

The roadmap's own guidance, and the reason this file exists:

> Extension implementation starts after the website core is stable.
> Reusable logic must not be placed under `apps/web`.

The extension is intended to become the differentiated product — generating
addresses, receiving verification mail, detecting codes, and staying in the
signup flow. Doing that first would mean building mailbox logic inside an app
with no shared core, and then extracting it under time pressure. Building the
website core first means the extension consumes logic that already exists.

## Rules that apply when this directory is filled

1. **No provider wire format here.** The extension calls providers through
   `@spectre-mail/providers`. It must not contain a provider JSON field name.
2. **Mail.tm is primary, Guerrilla Mail is fallback** for this client, per
   `openspec/specs/provider-abstraction/spec.md`. The website's single-provider
   setup is not this client's setup.
3. **Host permissions use the wildcard path form.** `https://api.mail.tm/*` is
   required; `https://api.mail.tm` silently grants nothing. This is measured —
   see `docs/PROVIDERS.md` §2.
4. **A test must exercise the declared host permission against the live
   provider.** That check is **deferred**, not done, and is tracked against the
   milestone that owns extension and provider infrastructure. No result is
   claimed for it. See the "Deferred verification" section of the root README.
5. **Reusable logic goes in `packages/`, never here and never in `apps/web`.**
   Enforced by `tests/architecture/boundaries.test.ts`.
