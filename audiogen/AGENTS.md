# AGENTS.md — audiogen (Echo)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Generates TTS audio for lessons (and wherever else the platform needs speech). Internal service — `INTERNAL_API_KEY` only.

## Open decision

**TTS provider: OPEN** (tracked in ROADMAP.md). Sibling precedent: Qwen3-TTS voice clone. The provider is abstracted behind `TTS_PROVIDER`/`TTS_API_KEY` env — code against an adapter interface, not a vendor SDK surface.

## Invariants that bite here

- **Per-locale voices:** every audio asset exists for en-US, es-MX, pt-BR — same parity rule as text i18n (§1.8).
- Kid-safe output: generated audio for kids goes through the same moderation posture as text (§1.9); no minor PII in TTS requests.
- Audio artifacts are stored in our storage (Supabase Storage) — never hotlinked from provider URLs.
- Bulk paid-API runs are a BOUNDARIES action.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
