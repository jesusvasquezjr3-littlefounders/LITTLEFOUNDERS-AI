# Courier engine — Haraka config (`email-server/haraka/`)

This is the [Haraka](https://haraka.github.io/) config directory that Courier's
supervisor (`../src/index.ts`) boots with `haraka -c ./haraka`. Haraka is the
**open-source SMTP engine** chosen for Courier (see [../AGENTS.md](../AGENTS.md)
and [/DEPLOYMENT.md](../../DEPLOYMENT.md)); it runs as a **send-only outbound
relay** that forwards every internal message to **Amazon SES** over TLS + SMTP
AUTH. SES owns the warm IP reputation that keeps auth mail out of spam.

## Flow

```
GoTrue (Supabase auth)  ─┐
                         ├─(SMTP, Railway private net / localhost)─▶  Haraka  ─(TLS+AUTH)─▶  Amazon SES ─▶ inbox
Courier HTTP API adapter ┘        relay_internal marks these                 smtp_forward
(POST /api/v1/send, nodemailer)   private-source connections as relaying      (smarthost)
```

## Files

| File | Purpose |
|---|---|
| `config/plugins` | Enabled plugins, in order: `relay_internal`, `rcpt_to.in_host_list`, `queue/smtp_forward`, `log_delivery`. |
| `config/smtp.ini` | Listeners (`[::]:587` for GoTrue over the private net, `127.0.0.1:2525` for the local adapter) and `nodes=1` (one worker — cost). |
| `config/host_list` | Empty — no local delivery domains (send-only relay). |
| `config/loglevel` | `info`. |
| `config/smtp_forward.ini.example` | Template of the SES smarthost config. The **real** `config/smtp_forward.ini` is rendered at boot from env and git-ignored (holds SES creds). |
| `config/me` | Rendered at boot from `HARAKA_HOSTNAME`; git-ignored. |
| `plugins/relay_internal.js` | Grants relaying to connections from the Railway private network (IPv6 ULA) + localhost. Not an open relay — the listener has no public domain. |
| `plugins/log_delivery.js` | On `hook_queue_ok`, reports each relayed message to Courier's own HTTP API on localhost (`POST /api/v1/logs`), which writes it to `email_logs`. This is the ONLY way GoTrue's auth mail reaches the admin console — it arrives over SMTP and never touches the HTTP API. Holds no DB credentials and contains no SQL: the typed, tested write lives in `src/db/emailLogsRepo.ts`. Fire-and-forget with a 2 s timeout, every failure swallowed — a logging outage must never bounce a password reset. |

## Security posture

- **Internal-only.** No public Railway domain; only our own services reach the listener (`/AGENTS.md` §1.5).
- **Not an open relay.** Only private-source connections may relay; untrusted sources are rejected at RCPT.
- **Sensitive hop is protected.** Courier → SES is always TLS + SMTP AUTH.
- **Secrets never committed.** SES credentials live only in Railway env → rendered into `config/smtp_forward.ini` at boot; that file and `config/me`, the outbound `queue/`, and any `*.pem`/`*.pid` are git-ignored.
- **Hardening follow-up:** move the internal hop from IP-trust to SMTP AUTH over a trusted internal cert once GoTrue's SMTP TLS handling is verified end-to-end.
