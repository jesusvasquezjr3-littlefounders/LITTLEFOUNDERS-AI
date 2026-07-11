# AGENTS.md — parent-id-check (Guardian)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Guardian identity verification. **The ONLY path** to `parent` status, verified guardian links, and the `kid`/`bigfounder` verified states. Internal service — `INTERNAL_API_KEY` only (plus provider webhooks with signature verification).

## Open decision

**Provider: OPEN** (tracked in ROADMAP.md) — candidates: Stripe Identity, Persona, Veriff, manual review. Code against a provider-agnostic adapter interface; webhook signature verification is mandatory regardless of provider.

## Invariants that bite here

- **Strictest PII handling in the platform.** Verification documents/data: never logged, never stored beyond provider requirements, never sent anywhere but the chosen provider.
- **Every verification event is audit-logged** (append-only, §1.3).
- Verification verdicts flow to backend/DB as status changes on `guardian_links` — this service never grants roles directly.
- Webhooks: verify `ID_PROVIDER_WEBHOOK_SECRET` signatures before trusting any payload.
- Failing open is forbidden: provider errors → verification stays unverified.

## Read before touching

- `/AGENTS.md` §1.3 (guardian links) + §1.9 (child safety) — both blocking here.
- `agent/core/BOUNDARIES.md` — role/permission logic requires human sign-off.
