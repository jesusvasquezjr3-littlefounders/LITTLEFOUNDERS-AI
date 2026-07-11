# email-server (Courier)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Open-source transactional email service replacing Resend.
**Port (dev):** 4005 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`)

```bash
npm install
cp .env.example .env
npm run dev
npm test
```

## Engine decision — OPEN

The scaffold exposes a stable send contract over a no-op adapter. Candidates:

| Engine | Language | Pros | Cons |
|---|---|---|---|
| [Postal](https://github.com/postalserver/postal) | Ruby | Full delivery platform (Sendgrid-style): dashboards, bounce/complaint tracking, webhooks | Heavy for Railway (multiple processes + MySQL/RabbitMQ) |
| [Maddy](https://github.com/foxcpp/maddy) | Go | All-in-one modern SMTP, single binary, easy to containerize | No delivery dashboard/API — needs our thin API in front (this service) |
| [Haraka](https://github.com/haraka/Haraka) | Node | Plugin architecture, same language as our stack | More of an SMTP toolkit than a product; deliverability tooling DIY |
| [Stalwart](https://github.com/stalwartlabs/mail-server) | Rust | Modern all-in-one (SMTP/IMAP/JMAP), single binary, actively developed | Younger project; API-driven sending needs our layer in front |

**Criteria:** Railway-deployability, deliverability tooling (DKIM/SPF/bounces), API surface for this service to wrap, maintenance burden.

## Routes

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health envelope |
| POST | /api/v1/send | Queue an email `{ to, subject, html?, text? }` → `{ data: { id, status: "queued" } }` (no-op adapter until engine lands) |
