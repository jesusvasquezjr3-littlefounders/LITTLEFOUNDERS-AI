# AGENTS.md — gamegen (Arcade)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Creates personalized educational minigames for users, bound to learn/ concepts. Internal service — `INTERNAL_API_KEY` only.

## Open decision

**Approach: OPEN** (tracked in ROADMAP.md) — fully generated HTML5 sandboxed games vs parameterized prebuilt templates. The scaffold is approach-neutral; don't commit to either without human sign-off (stack-of-record adjacent).

## Invariants that bite here

- **Every game binds to a learn/ concept id** — orphan games don't exist (the link is data, not convention).
- **Sandboxed output:** game code makes no external network calls; assets served from our storage.
- All AI-generated text/assets shown to kids pass moderation (§1.9) — non-optional.
- Rewards flow through backend validation — client-reported scores are never trusted for rewards.
- All game UI strings: i18n ×3 locales (§1.8).

## Read before touching

- `agent/prompts/templates/new-minigame.md` — the minigame protocol.
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
