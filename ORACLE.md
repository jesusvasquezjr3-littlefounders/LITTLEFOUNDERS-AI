# ORACLE.md — AI Tutor (approved design, NOT implemented)

> **STATUS: FUTURE.** The owner decided (2026-07-25) that the AI Tutor feature
> is too complex to build in passing and needs a dedicated session. This
> document captures the complete v1 design ("Money Moments") as it was
> analyzed, prototyped, and then REVERTED (the revert commit sits on top of
> `67dfb6e` — that commit holds a complete, working reference implementation
> if the future session wants to start from it via `git show`). Nothing
> described here exists in the active codebase.

## Rationale (edtech analysis 2026-07-25)

Source pattern: Google Labs *Little Language Lessons* — "Tiny Lesson": the
learner's real SITUATION, not a curriculum node, as the unit of learning
(transfer-appropriate processing). Their collection demonstrates that
context-first engages better than "pick lesson 37", and that the WHOLE
artifact can be generated in one pass and moderated BEFORE being shown.

Critical safety adaptation (§1.9): the child NEVER writes free text — they
pick from a **closed, curated taxonomy of situations**, so no data about the
minor ever travels to third-party APIs. "On demand" at runtime means reading
from a pre-approved pool in Vault: zero unfiltered AI in front of a child,
zero latency.

## Designed v1 architecture (Money Moments)

1. **Situation taxonomy** — human-curated YAML, trilingual BY HAND (a
   *tianguis* is not a yard sale and not a *feira*): 8 initial situations
   (allowance, corner store, *tianguis* street market, in-game skin, card
   trade, school fundraiser sale, birthday money, savings goal), each with
   `id`, `icon`, applicable `tiers`, and `title`/`description` per locale.
   Proposed location: `coursegen/curriculum/money-moments/situations.yaml`.

2. **Vault (new migration)** — two tables with the service-role-only posture
   (RLS with no client policies, like `lesson_documents`):
   - `tutor_situations(id text pk, icon, title jsonb, description jsonb, tiers jsonb, position)`
   - `tutor_packs(id uuid, situation_id fk, tier, locale, pack jsonb,
     status review|published|archived, unique(situation_id, tier, locale))`

3. **Pack contract** (Zod): `terms` (3-5 terms defined in kid words),
   `phrases` (2-3 "what to say/do" items with the why behind each),
   `quick_check` (1 question, EXACTLY 3 options, ONE correct, `rationale_md`
   per option — distractors are real misconceptions).

4. **Generation (Forge, offline)** — `tutor:packs` CLI:
   - `--sync-situations` (free): YAML → `tutor_situations`.
   - `--generate --confirm` (PAID, idempotent — an existing pack is never
     paid for twice): for every missing situation×tier×locale, DeepSeek with
     corrective retry (static-first prompts, per the prefix-cache discipline)
     → deterministic validation (exactly-one-correct, unique ids, the tier's
     forbidden vocabulary from `taxonomy.yaml`, outlier readability bands like
     gate 9) → upsert as `status='review'`.
   - **Publishing is a HUMAN flip** — the same blocking kid-safety gate as
     lessons (§1.9). Initial volume: 60 packs (~cents with the prefix cache).

5. **Core** — `/api/v1/tutor`:
   - `GET /situations`: picker with availability for the caller's tier
     (derived from `profiles.birth_date`: ≤7 tier1, ≤9 tier2, rest tier3;
     unknown → tier2) and their locale.
   - `GET /situations/:id/pack`: resolution ladder
     exact(tier,locale) → tier@es-MX → locale → any; packs in `review` are
     NEVER served (pinned by a test in the prototype).

6. **Frontend** — `/tutor` (replaces the ComingSoon): situation picker grid →
   pack view (terms, phrases, quick challenge with rationale reveal and
   retry; grading is deliberately client-side: this is practice, carries no
   XP, and does not warrant server-side grading) → an honest "in preparation"
   state when the pack is not published.

## Extensions designed for after v1 (from the analysis, not prototyped)

- **Per-node anchor** (roadmap.sh pattern): "help me with THIS topic" — the
  conversation is always scoped to a map node with the micro_objective
  injected server-side; never open chat as the first surface.
- **LearnLM-style tutor prompt**: pedagogy as system instructions (active
  learning, cognitive-load management, curiosity, metacognition) + an offline
  evaluation arena (blind pairwise comparisons against a rubric) BEFORE
  anything is exposed to a child.
- **Demand telemetry**: log of chosen situations (category IDs only, never
  free text) → a "requested but thin in the catalog" report for content
  planning.
- **Live chat (v3+)**: requires moderation-before-screen (stream into a
  moderation buffer, not straight through), §1.9 context limits (age band +
  first name at most), rate limits, and parental visibility of transcripts.

## Non-negotiable rules for the future session

1. CLOSED taxonomy: the picker never evolves into a free-text box for the
   child — that is exactly where §1.9 gets violated.
2. All kid-facing content passes validation + judge + human publication
   BEFORE it is visible. No "it's only a tutor" exceptions.
3. Only the providers already fixed in §1.2 (DeepSeek/Qwen). Nothing new.
4. The reference implementation lives in `git show 67dfb6e` — use it as a
   starting point, not as truth: it was written in a general session, and the
   dedicated session must re-evaluate every decision.
