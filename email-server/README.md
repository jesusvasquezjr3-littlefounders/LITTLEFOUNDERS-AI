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
| POST | /api/v1/send | `{ to, subject, html?, text?, templateType?, locale?, userId? }` → `202 { data: { id, status: "queued" }, error: null }`. Requires `x-internal-api-key`. Recorded in `email_logs`. |
| POST | /api/v1/logs | `{ messageId, to, subject?, status?, templateType?, locale?, userId?, detail? }` → `202 { data: { recorded, messageId }, error: null }`. Delivery capture for the SMTP path — called by the `log_delivery` Haraka plugin so GoTrue auth mail reaches the admin console. Requires `x-internal-api-key`. |
| GET | /api/v1/logs | Query: `?limit=1-200&offset=0+`, optional `q`, `status`, and `templateType`. Newest-first page `{ entries, total }` from `email_logs`. Returns `502 DATA_UNAVAILABLE` rather than serving partial production history when Vault cannot answer. Requires `x-internal-api-key`. |
| GET | /api/v1/logs/summary | Returns exact `{ total, statuses, templates, locales, trend }` aggregate, with a 30-day daily trend. If the trend cannot be calculated, the exact aggregate is returned without `trend`; if the durable store cannot answer, returns `502 DATA_UNAVAILABLE`. Requires `x-internal-api-key`.

## Environment

See [`.env.example`](.env.example). Key vars: `EMAIL_ENGINE` (`noop`\|`haraka`), `INTERNAL_API_KEY`, `MAIL_FROM`, the `HARAKA_*` listener knobs, (when `haraka`) the `SES_RELAY_HOST` / `SES_SMTP_USER` / `SES_SMTP_PASS` smarthost credentials, and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for the durable `email_logs` history (optional — without them history is in-memory only and dies on restart). `SES_SMTP_USER`/`PASS` are region-scoped SES **SMTP** credentials, not AWS console/access keys. Boot crashes (never serves half-configured) if `EMAIL_ENGINE=haraka` without the `SES_*` set, or if `INTERNAL_API_KEY` is missing in production.

## Live in production (2026-07-18)

Courier is **deployed and delivering real auth mail** — GoTrue → Courier (Haraka) → Amazon SES, verified in production (SES `250 Ok` on live signups). The wiring that was done, for the record:

1. ✅ **Amazon SES** (us-east-1) — domain identity verified, Easy DKIM (RSA-2048), custom MAIL FROM (`mail.littlefounders.ai`), production access granted, SMTP credentials issued.
2. ✅ **DNS (Vercel zone)** — SES DKIM (3 CNAMEs) + MAIL FROM SPF/MX + `_dmarc` TXT (`p=none`). The old **Resend** records (`resend._domainkey`, `send` TXT/MX) were removed — Courier uses `mail.*`, not `send.*`.
3. ✅ **Railway service** — `email-server` in project `littlefounders-b2c`, `EMAIL_ENGINE=haraka` + `INTERNAL_API_KEY` + `MAIL_FROM` + `SES_RELAY_HOST`/`SES_SMTP_USER`/`SES_SMTP_PASS`. No volume, no public domain, kept always-warm (not scaled to zero).
4. ✅ **Deploy** — live, `/health` 200, clean logs.
5. ✅ **GoTrue → Courier** — `SMTP_HOST=email-server.railway.internal`, `SMTP_PORT=587`, `SMTP_USER`/`PASS` empty (internal IP-relay), `SMTP_ADMIN_EMAIL=noreply@littlefounders.ai`, `SMTP_SENDER_NAME=LittleFounders`, `GOTRUE_MAILER_AUTOCONFIRM=false`. Branded trilingual templates wired via `GOTRUE_MAILER_TEMPLATES_*`/`SUBJECTS_*` (`frontend/public/email-templates/`).
6. ✅ **Tested** — real signup → branded confirmation email delivered (SES `250`, message-id returned); language follows the user's registration locale.

**One optional owner step remains:** set the repo variable `EMAIL_SERVER_LIVE=true` (`gh variable set EMAIL_SERVER_LIVE --body true`) to activate the CD workflow ([`email-server-cd.yml`](../.github/workflows/email-server-cd.yml)) so future `email-server/` changes auto-deploy. Until then the service is live but redeploys are manual (`railway up email-server --path-as-root --service email-server --ci`).
