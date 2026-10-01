# SpectreMail — provider compatibility spike (M0)

**This directory is disposable technical scaffolding, not product code.**

It exists to answer one question before any UI is built: can a browser client
actually complete a real temporary-mailbox lifecycle against the providers
SpectreMail plans to use?

## Rules

- Nothing here may be imported by `apps/web`, `apps/extension`, or any
  `packages/*` workspace. The provider code written here is throwaway.
- Real reusable provider logic belongs in `packages/providers` (milestone M3).
- This directory is **retired or absorbed during M1/M3**. Do not grow it into
  a home for provider logic.

## Run it

```bash
pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike exec playwright install chromium
pnpm --dir tests/provider-spike spike
```

The run writes a machine-readable artifact and a summary to
`tests/provider-spike/.runs/` (gitignored). `docs/PROVIDERS.md` is written
from a real run — never from assumptions.

### Outcomes

Every probe reports exactly one of:

| Outcome | Meaning |
| --- | --- |
| `passed` | Observed working, with evidence. |
| `failed` | Observed broken, with evidence. |
| `unsupported` | The provider does not implement the operation. |
| `unverified` | The spike could not run the check. **Never counted as success.** |

## Real external message delivery

Proving that a *real external* message arrives needs a sender that genuinely
delivers mail. Nothing that is free and credential-free can do that
(Ethereal discards all mail; Guerrilla's send endpoint is captcha-gated), so
the delivery check is configured, not faked.

Pick one:

**A. Interactive (no credentials).** Prints a live address and polls:

```bash
pnpm --dir tests/provider-spike spike:interactive
```

Send one message to the printed address from any existing mailbox, then the
harness observes it through the provider's own list/fetch API.

**B. Configured sender.** See `.env.example`. SMTP and HTTP send endpoints are
both supported; credentials are read from the environment and never written to
disk or to the run artifact.

If neither is available, the delivery checks are recorded as `unverified` with
the reason. That is the correct outcome — not a pass.
