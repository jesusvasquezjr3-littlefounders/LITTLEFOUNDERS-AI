# AGENTS.md — email-server (Courier)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Transactional email for the platform — the open-source replacement for Resend. Internal service — `INTERNAL_API_KEY` only. Consumers code against the `POST /api/v1/send` contract; the engine behind it is swappable.

## Open decision

**Engine: OPEN** — candidates and criteria in [README.md](README.md). Until decided, `send` routes through a no-op adapter (`src/services/adapter.ts`) that logs and reports queued. **Sending real email is a BOUNDARIES action.**

## Invariants that bite here

- The send **contract is stable** even while the engine is undecided — consumers never change when the engine lands.
- No PII beyond what the email itself requires; no minor PII in email bodies to third parties (§1.9).
- Kid-related emails go to the guardian, not the kid, unless a parent has opted otherwise.
- Templates will be i18n'd ×3 locales like everything else (§1.8).

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
