# AGENTS.md — email-server (Courier)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md). Production/deploy: [/DEPLOYMENT.md](../DEPLOYMENT.md).

## Mission

Transactional email for the platform — the open-source replacement for Resend. Internal service — `INTERNAL_API_KEY` only. Consumers code against the stable `POST /api/v1/send` contract; the delivery engine behind it is swappable.

## Engine — DECIDED: Haraka → Amazon SES relay

The engine is **[Haraka](https://haraka.github.io/)** (MIT, semver ≥1.0, Node/JS — same stack), run as a **send-only outbound SMTP relay** that forwards every message to **Amazon SES** over TLS + SMTP AUTH. We self-host the control plane (SMTP endpoint, queue, logs, provider-swappable); SES owns the warm IP reputation that keeps auth mail out of spam. Config lives in [`haraka/`](haraka/README.md).

**Why a relay, not direct send:** Railway blocks/does-not-provide outbound port 25 and you cannot set PTR on its IPs, so a self-hosted MTA cannot deliver direct-to-MX. Renting SES's last-mile reputation is the correct architecture, not a compromise — self-host what you should, rent the IP reputation.

**Two processes, one container** (supervised by `src/index.ts`): the Haraka engine (the private SMTP endpoint GoTrue talks to + the SES relay) and the Express HTTP API (`/health`, `POST /api/v1/send`, whose `SmtpAdapter` submits into Haraka on localhost). If the engine dies the supervisor exits non-zero so Railway restarts.

**`EMAIL_ENGINE`**: `haraka` (default in production) boots the engine and requires the `SES_*` credentials; `noop` (default in dev/test) logs and reports queued so `npm run dev`/tests need no SMTP. **Sending real email is a BOUNDARIES action.**

## Invariants that bite here

- The send **contract is stable** (`{ to, subject, html?, text? }` → `{ data: { id, status: "queued" }, error: null }`, 202) — consumers never change when the engine or provider changes.
- **Internal-only, never public.** No public Railway domain. The Haraka listener grants relaying by private-IP trust (Railway's IPv6 private net) — it is NOT an open relay (untrusted sources are rejected at RCPT) but it MUST never get a public domain.
- **Secrets are rendered at boot, never committed.** `haraka/config/smtp_forward.ini` (SES creds), `haraka/config/me`, and the boot-generated `tls_*.pem` are git-ignored + `.railwayignore`d. Only static config + the `relay_internal` plugin are tracked.
- **One worker.** `haraka/config/smtp.ini` pins `nodes=1` — Haraka, like Kong's nginx, defaults to one worker per CPU, the pattern that ballooned the Railway memory bill.
- **Always-warm.** GoTrue fires auth mail at random user times, so this service must NOT scale-to-zero.
- No PII beyond what the email itself requires; no minor PII in email bodies to third parties (§1.9). SES is a data sub-processor — keep bodies minimal.
- Kid-related emails go to the guardian, not the kid, unless a parent has opted otherwise.
- Auth mail is rendered by **GoTrue** from **branded, trilingual** templates hosted at `https://littlefounders.ai/email-templates/*.html` (source: `frontend/public/email-templates/`, wired via `GOTRUE_MAILER_TEMPLATES_*`/`SUBJECTS_*`). Each template picks its language from the user's registration locale via a Go `text/template` conditional; en-US is the fallback. Any FUTURE Courier-originated templates (non-auth) are i18n'd ×3 the same way (§1.8).

## Hardening follow-up (documented, not blocking)

The internal hop (GoTrue/adapter → Haraka) is plaintext-with-IP-trust because Haraka only advertises SMTP AUTH after STARTTLS and a self-signed internal cert is not reliably accepted by GoTrue. Move it to AUTH over a trusted internal cert once GoTrue's SMTP TLS handling is verified. The sensitive hop (Haraka → SES) is always TLS + AUTH.

## Read before touching

- [`README.md`](README.md) — architecture, env, routes, and the **"Live in production" wiring record**.
- [`haraka/README.md`](haraka/README.md) — the engine config dir.
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
