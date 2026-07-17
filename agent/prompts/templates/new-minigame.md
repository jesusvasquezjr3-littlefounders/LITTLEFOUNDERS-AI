---
template: new-minigame
inputs:
  concept_id: "the learn/ concept this game teaches (REQUIRED — no orphan games)"
  mechanic: "core gameplay loop in one sentence"
---

# Task: add a minigame (gamegen / games section)

## Read first
- `gamegen/AGENTS.md` — generation & sandboxing rules
- `agent/core/CONTEXT.md` — games/ is bound to learn/ concepts by design
- `/AGENTS.md` §1.9 — moderation of AI output shown to kids is non-optional
- `/DESIGN.md` — visual rules (playful sub-standard TBD with mockup)

## Steps
1. Bind the game to `concept_id` — the link is data, not convention.
2. Game runs sandboxed (no external network calls from game code; assets via our storage).
3. All UI strings through i18n ×3 locales; sounds/haptics respect user settings.
4. Reward hooks: completion reports through backend (envelope API), never client-trusted scores for rewards.
5. Tests: game state logic unit-tested; completion→reward flow has happy + tamper sad path.

## Acceptance
- [ ] Concept binding present and queryable
- [ ] Moderation applied to any AI-generated text/assets
- [ ] gamegen + frontend suites green
