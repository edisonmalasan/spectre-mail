# Mail.tm attribution obligation — independent recheck and minimal UI proposal (2026-11-23)

**Worker:** M25 Worker C (research). **Base:** `origin/main` at `0418d60401f2facfdb5099a237c88f81ce2c8704`, verified 2026-11-23. **Branch:** `docs/mailgw-mailtm-recheck`, pushed with upstream tracking before any edit. **Investigation date:** 2026-11-23 (Asia/Shanghai, UTC+08:00). **Prior record read-only:** `docs/GOAL-REPORT.md` line 16, `docs/provider-research/guerrilla-mailtm.md`, `openspec/specs/`, all application code.

**Evidence vocabulary:** MEASURED = instrument output on this machine; DOCUMENTED = quoted from the provider's own page; INFERRED = interpretation; BLOCKED / NOT VERIFIED = no measurement. **No credential, token, password or shared secret was requested, generated, logged, sent or stored. No account was created, no provider API operation was invoked by this recheck.** Documentation pages only.

## 1. The verbatim language (DOCUMENTED, two independent network paths)

**Source URL:** `https://docs.mail.tm/` → section **Policy → Terms of Use** (the site's own nav labels it `Policy`; the heading is `Terms of Use`).
**Retrieval date:** 2026-11-23. Fetch calls are bracketed by shell `Get-Date -Format o` outputs `2026-11-23T05:45:00.0127413+08:00` and `2026-11-23T05:49:36.0208951+08:00` (UTC `2026-11-22T21:45:00Z`–`21:49:36Z`). The verbatim line was confirmed again at `2026-11-23T05:49:35.7769695+08:00`–`05:49:36.0208951+08:00`.

> **Attribution required**
>
> **"If you use our API, link back to mail.tm somewhere visible."**

The heading and sentence are rendered as separate elements on the page; `webfetch` text/markdown flattens them to `Attribution required If you use our API, link back to mail.tm somewhere visible.` The same section publishes, verbatim:

> "No reselling Don't build a paid product that just wraps our API."
>
> "No proxy services Don't mirror or proxy our API under a different domain."

`https://docs.mail.tm/` itself links the word `Mail.tm` in its footer to `https://mail.tm`, which is the natural link-back target for the clause. The clause says "mail.tm" (lowercase); a hostname is case-insensitive. No publication date for the clause is shown on the page; the page's Nuxt payload contains a `prerenderedAt` number, which is **not** evidence of when the clause was published, so no publication date is claimed — only the **retrieval date** 2026-11-23.

### Exact evidence

```text
fetch GET https://docs.mail.tm/ (format=text)
fetch GET https://docs.mail.tm/ (format=markdown)
-> identical content; Policy / Terms of Use section contains:
   "- Attribution required If you use our API, link back to mail.tm somewhere visible."

PS> Get-Date -Format o
2026-11-23T05:49:28.1223802+08:00
PS> curl.exe -sS -m 25 -A 'Mozilla/5.0 ... Chrome/158.0.0.0 Safari/537.36' -o NUL -w 'http_code=%{http_code} remote=%{remote_ip} total=%{time_total}s\n' https://docs.mail.tm/
http_code=200 remote=172.67.68.124 total=0.144352s
PS> curl.exe -sS -m 25 -A 'Mozilla/5.0 ...' https://docs.mail.tm/ | Select-String -Pattern 'Attribution required|...'
-> rendered HTML contains: <div ...><!--[-->Attribution required<!--]--></div>
   <div ...><!--[-->If you use our API, link back to mail.tm somewhere <!--]-->visible.<!--]--></div>
PS> Get-Date -Format o
2026-11-23T05:49:36.0208951+08:00
```

One tool-shape difference is recorded rather than smoothed over: `curl.exe -sS -I https://docs.mail.tm/` returned `HTTP/1.1 403 Forbidden`, `Date: Sun, 22 Nov 2026 21:49:20 GMT`, `Server: cloudflare`, while a browser-UA **GET** from the same machine returned 200 and the fetch service's GET returned 200. The 403 is a HEAD/UA/path behaviour on Cloudflare's side; it is **not** a claim that the page is unavailable, and it does not weaken the verbatim GET evidence.

### Relationship to the existing record (DOCUMENTED)

- `docs/GOAL-REPORT.md:16` records Mail.tm as `BLOCKED / NEEDS AUTHORIZATION` with the reason _"newly published attribution clause unmet; 'no proxy services' ambiguous."_ This recheck confirms the attribution half of that sentence with a dated, verbatim source.
- `openspec/specs/provider-abstraction/spec.md:266-272` still says _"No attribution obligation is asserted here, because none could be verified"_ and withdraws earlier quotations. That note is now **false as a record of the tree**, and is identified in §4.
- `openspec/specs/privacy-disclosure/spec.md:189` still says _"No terms page was located for Mail.tm — every route tried returned nothing"_ and its scenario at line 230 still requires naming Mail.tm's terms as not located. The terms page is now located. See §4.

## 2. Minimal truthful UI placement and copy (PROPOSAL only — not implemented)

**Scope: extension only.** The website's only browser-reachable provider is Guerrilla Mail (`apps/web/src/provider-config.ts`); the website does not use Mail.tm, so adding a Mail.tm link there would be a false claim. The extension uses Mail.tm primary with Guerrilla Mail fallback, and the promoted rule _"A verified attribution obligation applies to one client"_ (`provider-abstraction/spec.md:258-264`) explicitly says one client's implementation cannot satisfy another's.

**Placement.** In the extension's popup and side panel, render **one small factual line directly beneath the provider-named address heading**, only when the mailbox actually shown was served by Mail.tm. Do not put it in the heading: `Panel.tsx:854` and `Popup.tsx:499` use `providerDisplayName(...)` in an `h2#address-heading`, and `surface-hierarchy` asserts that heading's accessible name and the address's type rank. Wrapping the heading in a link would change its role/accessible name and make the whole name actionable; an adjacent line does neither.

**Copy (proposed, verbatim):**

> Provider: [Mail.tm](https://mail.tm)

with the anchor carrying `target="_blank" rel="noopener noreferrer"` (the repo's existing external-link rule; `MessageView.tsx` is the precedent). The words **"Provider:"** are a factual label, not a claim of sponsorship.

**Conditions that keep it truthful:**

- Render **only** when the displayed mailbox's provider is Mail.tm. When the Guerrilla fallback served the mailbox, render nothing — Guerrilla's published terms contain no attribution clause (prior record), and claiming otherwise would invent an obligation.
- Take the displayed name from the existing `providerDisplayNames` / `providerDisplayName` abstraction (`apps/extension/src/provider-config.ts`), not a second literal; do not introduce a new provider name spelling.
- Declare the link target once in the provider layer/config, not inside UI copy. `packages/providers/src/contract.ts:100` currently declares `displayName` only — there is no provider URL field, so an implementation change must add one rather than letting a client invent a URL. **This recheck changes none of it.**
- Do **not** render when no Mail.tm session exists; do not make the link a provider-status or delivery claim.

**Copy explicitly rejected, with the reason:**

- "Powered by Mail.tm" — implies sponsorship/endorsement the provider did not state.
- "Partner" / "Supported by Mail.tm" — false; no partnership exists.
- A Mail.tm logo or badge — implies endorsement and requires an asset the product does not own.
- A website footer link — wrong client; the website cannot reach Mail.tm, so it would name an unavailable provider as if available.
- A link in the popup/panel heading — changes the heading's role/name and the verified `surface-hierarchy` contract.

**What this does NOT do:** it does not make Mail.tm `CLEARLY PERMITTED`. The "No proxy services" clause remains ambiguous for a free competing client, and `docs/GOAL-REPORT.md:79` keeps written authorization as a `NEEDS AUTHORIZATION` gate. Adding the link is a necessary, verifiable step toward satisfying one clause; **it is not authorization and does not change any provider decision.**

## 3. Minimal test shape for a future implementation (not written here)

- Popup and panel, Mail.tm-backed mailbox: a real `<a href="https://mail.tm" ...>` is present and visible (computed style, not just DOM), and its text is the abstraction's Mail.tm display name.
- Same surfaces with a Guerrilla-backed mailbox: no Mail.tm link.
- Website: no Mail.tm link.
- The address heading's role and accessible name are unchanged.
- The link target is read from the provider-owned declaration, so a client cannot drift to a different URL.

## 4. Exact promoted requirements that would need amendment

No code and **no spec was changed by this worker**. The following are the exact promoted locations read at the base commit; a future OpenSpec change must amend them rather than add a contradicting sibling.

1. **Primary — `openspec/specs/provider-abstraction/spec.md`, Requirement `Provider terms are not assumed` (heading at line 245).** Its measured-basis note at lines 266–272 says no attribution obligation could be verified and withdraws the earlier quotations. That note must be replaced (a `MODIFIED` block, carrying its scenario forward in full) with the verified 2026-11-23 source and the verbatim clause. The scenario at **lines 258–264** — _"A verified attribution obligation applies to one client"_ — is the rule that already requires the extension to carry the attribution; it need not be rewritten, but its note must stop contradicting it.

2. **Also affected — `openspec/specs/privacy-disclosure/spec.md`, Requirement `Provider attribution is stated in neither direction` (heading at line 182).** Its factual basis at **line 189** ("No terms page was located for Mail.tm") and the third clause of the scenario at **line 230** ("it SHALL name Mail.tm's terms as not located, and name the paths that were tried") are now measured false. **BLOCKED decision for the orchestrator:** the same requirement's body at lines 184–185 forbids the privacy document from stating that an attribution obligation exists, while line 186 requires quoting what the terms say — and the newly located clause is literally headed "Attribution required". An amendment must be worded so the document reports the verified quote without "resolving" attribution in either direction, or the requirement will contradict itself. Do not silently rewrite it.

3. **New requirement needed in `openspec/specs/extension-client/spec.md`.** There is currently no promoted extension requirement for a visible provider link-back; a search of that spec found no attribution or footer requirement. The nearest requirement is **`A surface names a provider the way the provider names itself`** (heading at line 1643), which governs the _name_ only — folding a link obligation into it would conflate two properties. A future change should add an explicit `ADDED` requirement to `extension-client` (or amend the provider-abstraction scenario to name the extension surface explicitly), with the falsifiable cases in §3.

**Not the right target:** `openspec/specs/website-client/spec.md`'s `The page's limits are stated in its footer` (line 1065) already requires provider attribution, but only for the provider the website reaches (Guerrilla), and `provider-abstraction`'s scenario forbids treating one client's implementation as satisfying another's. `docs/PROVIDERS.md` is a protected path and was not touched by this recheck; its §2 still records the 2026-10-02 "no terms page" measurement, which is a historical record rather than a claim about 2026-11-23.

## 5. Counts kept distinct (GOAL §3/§8 vocabulary)

| Measure                             | Value on 2026-11-23                                                                                                                      | Provenance                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Candidate providers in this recheck | **0** — Mail.tm is an existing provider, not a new candidate                                                                             | This document                                  |
| Permitted integrations              | **0 new** — the attribution clause is unmet today; satisfying it would not resolve "no proxy services" or the written-authorization gate | `docs/GOAL-REPORT.md:16,79` + this recheck     |
| Live domains                        | **1** (`euploading.com`), as recorded in `docs/GOAL-REPORT.md:40` at `2026-11-22T03:40:37Z`                                              | Inherited, **NOT re-measured by this recheck** |
| Created mailboxes                   | **0 by this recheck**                                                                                                                    | No provider API call made                      |
| Domains with verified incoming mail | **1** (`euploading.com`), recorded in `docs/GOAL-REPORT.md:42` and §D on 2026-11-22 at message level                                     | Inherited, **NOT re-measured by this recheck** |

No count above is upgraded by documentation reading. Attribution is a documentation finding, not a live-domain, mailbox or delivery measurement.

## 6. Blockers and ambiguities (BLOCKED, not PASS)

1. **BLOCKED — product decision.** Surface and exact copy for the link must be chosen in an approved OpenSpec change before implementation.
2. **BLOCKED — spec conflict.** The `privacy-disclosure` requirement's "neither direction" rule conflicts with quoting a clause literally headed "Attribution required"; the orchestrator must decide the amendment wording.
3. **BLOCKED — authorization.** The "no proxy services" ambiguity and the written-authorization gate remain open; Mail.tm stays `BLOCKED / NEEDS AUTHORIZATION`.
4. **NOT VERIFIED — clause publication date** and whether the provider will accept this placement as satisfying the clause; only the retrieval date and verbatim text are established.
5. **NOT VERIFIED — live state today:** current domains, CORS, account operations and delivery were not probed.

## 7. What this recheck did NOT verify

It verified only the current verbatim attribution text and its source URL/date, and proposed placement/copy; it did not implement the link, change any code, UI copy, spec or protected document, contact a provider API, re-measure live domains or delivery, or establish that Mail.tm is permitted or supported.
