# Security Policy

## Supported versions

hiperbrain is developed on `master`, and the `@hiperbrain/core` npm package
follows semantic versioning. Security fixes land on the latest release; please
make sure you are on the most recent version before reporting an issue.

| Component | Supported |
| --- | --- |
| `@hiperbrain/core` (latest minor) | ✅ |
| Older `@hiperbrain/core` versions | ❌ |
| The hosted site / API (`master`) | ✅ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Instead, report privately through one of:

- GitHub's private vulnerability reporting: open the repository's **Security**
  tab → **Report a vulnerability**.

Please include:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if possible),
- the affected component and version/commit.

We aim to acknowledge a report within **72 hours** and to provide a remediation
timeline after triage. Please give us a reasonable window to ship a fix before
any public disclosure. We are happy to credit reporters who wish to be named.

## Scope and sensitive areas

This project handles secrets and value-bearing flows. Areas where reports are
especially welcome:

- **API keys & credits** — the credit ledger, key issuance/verification, and the
  at-rest key encryption (`API_KEY_ENC_SECRET`, AES-256-GCM).
- **Wallet signature verification** — the ed25519 sign-in flow used to mint,
  list and revoke keys.
- **On-chain burn verification** — replay protection for redeemed burns.
- **Server secrets** — the Supabase service-role key and any `*_API_KEY` /
  `ADMIN_PASSWORD` env vars must never be exposed to the browser (no
  `NEXT_PUBLIC_` prefix).

## Out of scope

- The public collective brain is intentionally world-writable (moderated). Facts
  you can teach through the normal UI are not a vulnerability.
- Issues that require a compromised host, browser extension, or physical access.
- Missing best-practice headers without a demonstrated, concrete impact.

## Handling your own secrets

Never commit a real `.env*` file. Keep `SUPABASE_SERVICE_ROLE_KEY`, `HELIUS_API_KEY`, `ADMIN_PASSWORD` and `API_KEY_ENC_SECRET`
server-side only. If you believe a secret has been leaked, rotate it
immediately.
