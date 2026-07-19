# email-server (Courier)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md); production contract in [/DEPLOYMENT.md](../DEPLOYMENT.md).

**Mission:** Open-source transactional email service replacing Resend.
**Port (dev):** 4005 · **Deploy:** Railway (internal-only) · **Access:** `INTERNAL_API_KEY`

```bash
npm install
cp .env.example .env
npm run dev        # EMAIL_ENGINE defaults to 'noop' — logs, no real SMTP
npm test
```

## Engine — Haraka → Amazon SES relay

The delivery engine is **[Haraka](https://haraka.github.io/)** (MIT, semver ≥1.0, Node — same stack as us), run as a **send-only outbound relay** that forwards every message to **Amazon SES** over TLS + SMTP AUTH. We self-host the control plane; SES rents us the warm IP reputation that keeps auth mail out of spam. Direct-to-MX self-send is impossible on Railway anyway (no outbound port 25, no PTR control), so relaying is the correct architecture.

```
GoTrue (Supabase auth) ─┐
                        ├─ SMTP, Railway private net / localhost ─▶ Haraka ─ TLS+AUTH ─▶ Amazon SES ─▶ inbox
Courier HTTP API adapter┘   (relay_internal grants private sources)        (smtp_forward smarthost)
(POST /api/v1/send, nodemailer)
```

Both processes run in one container, supervised by [`src/index.ts`](src/index.ts); the engine config is in [`haraka/`](haraka/README.md). With `EMAIL_ENGINE=noop` (dev/test default) only the HTTP API runs, over a no-op adapter.

## Routes

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health envelope `{ data: { service, version, status: "ok" }, error: null }` |
| POST | /api/v1/send | `{ to, subject, html?, text? }` → `202 { data: { id, status: "queued" }, error: null }`. Requires `x-internal-api-key`. |

## Environment

See [`.env.example`](.env.example). Key vars: `EMAIL_ENGINE` (`noop`\|`haraka`), `INTERNAL_API_KEY`, `MAIL_FROM`, the `HARAKA_*` listener knobs, and (when `haraka`) the `SES_RELAY_HOST` / `SES_SMTP_USER` / `SES_SMTP_PASS` smarthost credentials. `SES_SMTP_USER`/`PASS` are region-scoped SES **SMTP** credentials, not AWS console/access keys. Boot crashes (never serves half-configured) if `EMAIL_ENGINE=haraka` without the `SES_*` set, or if `INTERNAL_API_KEY` is missing in production.

## Going live — the wiring checklist

The service is **built, tested, and CD-ready**. What remains is connecting it. Owner-only steps are marked 🔑.

1. 🔑 **Amazon SES** — create the SES identity, verify the `littlefounders.ai` domain, request **production access** (transactional; ~24h), and generate **SMTP credentials**.
2. 🔑 **DNS (Vercel zone)** — add the SES-provided DKIM CNAMEs, an SPF `include` for SES, a `_dmarc` TXT (`p=none`, ramping to `quarantine`), and a custom MAIL FROM subdomain.
3. **Railway service** — `railway add --service email-server` in project `littlefounders-b2c`; set env: `EMAIL_ENGINE=haraka`, `INTERNAL_API_KEY` (32+ chars), `MAIL_FROM`, `SES_RELAY_HOST`, `SES_SMTP_USER`, `SES_SMTP_PASS`. No volume, no public domain. Keep it **always-warm** (do not scale-to-zero).
4. **Deploy** — `railway up email-server --path-as-root --service email-server --ci`; confirm `/health` 200 and clean logs.
5. **Point GoTrue at Courier** — on the Supabase `auth` service set `SMTP_HOST=email-server.railway.internal`, `SMTP_PORT=587`, `SMTP_USER=`/`SMTP_PASS=` (empty — internal IP-relay), `SMTP_ADMIN_EMAIL=noreply@littlefounders.ai`, `SMTP_SENDER_NAME=LittleFounders`, and flip `ENABLE_EMAIL_AUTOCONFIRM=false`. (Template block in `database/supabase/docker/.env.example`.)
6. **Activate CD** — set the repo variable `EMAIL_SERVER_LIVE=true` so [`email-server-cd.yml`](../.github/workflows/email-server-cd.yml) begins auto-deploying.
7. **Test** — real signup → confirmation email lands in the inbox; password-reset + magic-link likewise; check SES + Courier logs for `250`; confirm SES bounce/complaint feedback is wired.

Until step 1–2 are done, sending fails at the SES AUTH handshake — verified end-to-end locally: the full path (adapter → Haraka → TLS to real SES → SMTP AUTH) works and SES returns `550 Authentication Credentials Invalid` for placeholder creds. Real creds = delivered.
