# SpectreMail Browser Findings

**What each engine can be asked, and what it can be asked here.** The parallel of
[`docs/PROVIDERS.md`](PROVIDERS.md), which records what each _provider_ does. This document records
what each _engine_ does — and, where an engine cannot be reached at all, **that it cannot be
reached and what was tried**.

**Everything here was measured on this repository, on this machine, against the engines this
machine has.** Every section says what the measurement does **not** establish, because that is the
half that keeps the next slice honest.

---

## 1. Headline result

**The extension tier runs in Chromium, and Chromium is the only engine this repository can verify
in.**

**And the finding that stopped M14 in its first slice is that the obstacle is not the product's
manifest.** The roadmap's M14 lists six things to adapt for Firefox — _manifest differences, browser
namespace differences, permissions, side-panel equivalent strategy, notification behavior, store
requirements_ — and the measurement says the first question is not what to adapt but **whether this
repository can reach Firefox at all**.

**Measured, it cannot** — and the reason is **not** the manifest, which is the opposite of what the
obvious reading of a failed Firefox install would say.

---

## 2. Chromium — what the extension tier establishes (measured 2026-10-05 onward)

**The extension's own configuration says this in as many words**, and the record of _why_ is in
[`docs/PROVIDERS.md`](PROVIDERS.md) §4:

> **Chromium only**, for the same reason the website's config says it — `--load-extension` is a
> Chromium flag. **No other engine here has it**, and the honest form of this claim is _"verified in
> Chromium"_ rather than _"verified in a browser"_.

**Every Chromium fact this repository holds is in `docs/PROVIDERS.md` §4** — the MV3 runtime facts
(§4.1), the content-script facts (§4.2), the in-page creation question (§4.4), the notification
facts (§4.5) and the side-panel facts (§4.6). **They are not repeated here**, because **a second
copy of a measurement is a second spelling of it**, and this repository's recorded defect.

**What this document adds is §3: the engine this repository _cannot_ reach.**

---

## 3. Firefox — measured before Firefox compatibility was designed (2026-10-21)

**Instrument:** `apps/extension/e2e/firefox-compatibility.mjs` — a quarantined probe, listed in
`QUARANTINED_PROBES`, and **not** in `package.json`'s scripts. **Its reader is self-tested before
any absence is reported**, because the first version of the measurement read Firefox's own record
from the wrong path and **so reported _the add-on was not installed_ for a profile where the answer
was simply not looked for** — **a reader that matches nothing reports the absence of the thing it
looked for**.

**The engine measured:** Playwright's Firefox, `firefox-1555`, **which reports 155.0**, and **which
is the only Firefox on this machine** — the standard install locations hold none and a bounded
search of the program directories found none.

### 3.1 The measurement

| Question                                                                                       | Measured answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | What it does **not** establish                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Can this repository load its extension in Firefox at all?**                                  | **No.** **0 of 10 arms installed** — nine manifest variants over the XPI route, plus the profile route over the positive control.                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Nothing about Firefox's capabilities.** The blocker is not the manifest; see the row below.                                                                                                                                                                                                                                 |
| **Is the blocker the manifest?**                                                               | **No.** A **`bare`** MV3 manifest — `manifest_version`, `name`, `version`, one `storage` permission, one background script — **failed identically to the shipped one.** And so did a `bare` manifest **with a gecko add-on id**.                                                                                                                                                                                                                                                                                                                                               | Nothing about which manifest key a Firefox _would_ refuse. The question is unasked, because the engine never got far enough to answer it.                                                                                                                                                                                     |
| **Then what refused it?**                                                                      | **Nothing refused it — and this is the finding.** The `sidePanel` permission, the `side_panel` key and the `background.service_worker` are **not** what Firefox refused, because **the variant with all three adapted failed exactly like the one with none adapted.**                                                                                                                                                                                                                                                                                                         | **That Firefox accepts them.** The measurement never got far enough to ask.                                                                                                                                                                                                                                                   |
| **Did Firefox look at all?**                                                                   | **Yes.** Firefox **rewrote its own `extensions.json`** — thirteen kilobytes of its own, holding **its own built-in add-ons and not this one** — over the record the measurement wrote, and it **consumed the XPI it was given**.                                                                                                                                                                                                                                                                                                                                               | Whether it _tried to install_ rather than merely _found the file_. **And the number of add-ons in Firefox's record varies between arms and between runs** — ten in most, seven in one — **so it is not a figure worth carrying**; **what it says is that the record is Firefox's own, and that this extension is not in it.** |
| **Did the route's premise hold?**                                                              | **Yes.** `xpinstall.signatures.required` is **`false`** in Firefox's **own `prefs.js`** in every arm — **read from Firefox's file, not assumed from the file the measurement wrote.**                                                                                                                                                                                                                                                                                                                                                                                          | Nothing further: the preference was not the obstacle, because it was not in force.                                                                                                                                                                                                                                            |
| **Which route could reach an install?**                                                        | **Only the XPI route.** The profile route **cannot work at all**: **Firefox rewrites `extensions.json` at startup**, so a hand-written record is discarded — **measured, and a fact about that route and not about Firefox.**                                                                                                                                                                                                                                                                                                                                                  | Whether the XPI route would have worked with a differently-built archive.                                                                                                                                                                                                                                                     |
| **Does Firefox say why?**                                                                      | **No.** Its own stderr names a **Juggler** error and three Windows-shell errors, and `MOZ_LOG` wrote no file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **No cause is claimed here.** The record does not name a reason it did not measure.                                                                                                                                                                                                                                           |
| **Does the extension's namespace exist in Firefox?**                                           | **Not measurable here.** No variant installed, so **no extension context existed to probe** — neither `browser.*` nor `chrome.*`.                                                                                                                                                                                                                                                                                                                                                                                                                                              | Nothing about Firefox's namespace.                                                                                                                                                                                                                                                                                            |
| **Which of the extension's eleven platform capabilities Firefox covers, and with what shape?** | **Not measurable here.** The eleven are `readChromeLocalArea`, `sendToBackground`, `onExtensionMessage`, `findActiveTab`, `sendToTab`, `onTabActivated`, `readNotificationPlatform`, `extensionAssetUrl`, `readAlarmPlatform`, `onBrowserStart` and `onAlarmFired` — **and the instrument asks each one for its presence _and_ its calling convention**, because a promise-based `browser` namespace against a callback-based `chrome` one is **a changed signature and not a missing method**, and **a measurement that records only presence would miss every one of them.** | Nothing at all about Firefox's coverage. **The probe exists and has never had an extension context to run in.**                                                                                                                                                                                                               |
| **What about the side panel?**                                                                 | **Not measurable here**, and it is a **decision** rather than an adaptation in any case: Firefox's `sidebar_action` is a **docked sidebar with no `open()` API**, so _the side panel_ has no Firefox equivalent and _a panel_ has a different one.                                                                                                                                                                                                                                                                                                                             | Nothing about whether the panel would work.                                                                                                                                                                                                                                                                                   |

### 3.2 What this establishes

**That this repository cannot verify its extension in Firefox, and that the obstacle is the
measurement substrate rather than the product's manifest.**

**⇒ So M14's implementation cannot begin on the assumption that the manifest is the work.** The
work is, in one sentence: **either obtain a Firefox that installs extensions — a real, unpatched
one, driven by a mechanism this repository does not yet have — or ship for Firefox unverified and
say so.**

**⇒ And the second branch is a product decision, not a technical one.** It is also the branch the
repository's own rule already anticipates: **an engine the tier cannot reach is named as
unreachable**, and **a claim about an engine is made per engine** — because _"verified in Chromium
and Firefox"_ is a phrase that means _"verified somewhere"_.

### 3.3 What this does not establish

- **Nothing about Firefox's capabilities.** Every row above is a fact about **this machine's reach**,
  and the instrument says so in its own output: _"That is a measurement of this machine's reach, not
  of Firefox's capabilities."_
- **Nothing about the manifest.** The `bare` arm **refutes** the reading that the manifest is what
  Firefox refused — **and a refutation is not an endorsement**: the manifest's compatibility with
  Firefox is **still unmeasured**, and it stays unmeasured until an engine that installs extensions
  is reached.
- **Nothing about the namespace, the eleven capabilities, or the side panel.** All three are
  **not measurable here**, and the probe that would measure them exists.
- **Nothing about a real Firefox.** **There is none on this machine**, so every statement above is
  about Playwright's patched build — **and that is the whole of the machine's Firefox**, which is
  why the record names it rather than saying _"Firefox"_.
- **No cause for the failure.** Firefox's own output did not name one, and **the record does not
  name a cause it did not measure.**

### 3.4 The one thing that would change the answer

**A Firefox that installs extensions.** The routes are known to work in principle — Firefox's own
developer route is an unsigned XPI with `xpinstall.signatures.required` off, and **the preference
was in force and did not help**. **So the next thing to measure is not the manifest but the
engine**: a real Firefox, installed and driven by a mechanism this repository does not have yet.

**And that is a decision for the roadmap, not for this repository's next slice.**

---

## 4. How to run the probe

```text
node apps/extension/e2e/firefox-compatibility.mjs
```

**It is not in `package.json`'s scripts**, deliberately: **a script name is an invitation**, and this
one takes about ten minutes and answers a question about a platform rather than about this product.
**It requires the extension to be built** (`pnpm --filter @spectre-mail/extension build`), and it
reads the built artefact rather than the source.

**It exits `0` when it has produced its measurement**, and it writes a structured report to the
system's temporary directory. **It never contacts a provider**, **it never contacts any origin**,
and **it writes nothing into the repository** — every profile it creates is in the temporary
directory and is removed afterwards.

**And its reader is self-tested first**, because **a reader that matches nothing reports the
absence of the thing it looked for** — which is the defect this repository has recorded more than
once, and which this measurement's own first version carried.
