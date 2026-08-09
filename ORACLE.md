# ORACLE.md — AI Tutor (approved design, NOT implemented)

> **STATUS: FUTURE.** The owner decided (2026-07-25) that the AI Tutor feature
> is too complex to build in passing and needs a dedicated session. This
> document captures the complete v1 design ("Money Moments") as it was
> analyzed, prototyped, and then REVERTED (the revert commit sits on top of
> `67dfb6e` — that commit holds a complete, working reference implementation
> if the future session wants to start from it via `git show`). The
> Data Intel → Core personalization boundary is now specified below and is
> ready for the future Tutor implementation, but no active Tutor surface
> consumes it yet.

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

## Data Intel personalization contract (future integration)

This section is the implementation contract for connecting Oracle to the
learning-intelligence system. It is intentionally narrower than the admin
console: the Tutor must receive a learner's derived state, not the warehouse,
raw behavioural history, or another learner's data.

### Current readiness

Data Intel already materializes an explainable state per learner and skill:

- `skillKey` — stable course/topic skill identity.
- `courseId` and `topicId` — curriculum context when available.
- `masteryProbability` — estimated mastery in `[0, 1]`.
- `uncertainty` — confidence limitation in `[0, 1]`; higher means less certainty.
- `evidenceCount` — number of authoritative learning records behind the state.
- `firstPracticedAt`, `lastPracticedAt`, and `reviewDueAt` — learning timeline.
- `recommendedAction` — one of `remediate`, `practice`, `retrieve`, or
  `continue`.
- `reasonCode` — a closed, explainable reason for the recommendation.

Core exposes this through the authenticated, caller-only route:

```text
GET /api/v1/learn/personalization
```

The response contains the highest-priority recommendation plus the learner's
derived skill states. Core calls Data Intel with the service-to-service key,
validates the response, and ensures the caller can receive only their own
state. The future Tutor must call Core, never Data Intel or DuckDB directly.

This is a prepared boundary, not a completed Tutor integration. The active
Tutor route and model runtime do not yet exist, and the current local Data
Intel migration/deployment handoff must be completed before this contract is
available in production.

### Runtime context allowed for a Tutor request

Core may combine the derived state with the minimum context required to answer
the current request:

1. authenticated learner identity, role, locale, and age band;
2. the current published course/topic/lesson context;
3. the relevant skill state and its evidence/uncertainty;
4. a closed learner intent or situation identifier;
5. safe product settings needed for language, accessibility, and difficulty.

For a minor, raw name, surname, location, email, answer text, free-form
history, and unrelated family data must not be sent to a third-party model.
The model must not receive raw `learning_events`, raw attempt rows, full
session histories, or another learner's state. The server must derive a small
Tutor context object first, then validate it before model invocation.

### Personalization behavior

The Tutor should use the state as pedagogical guidance, never as an
unquestionable diagnosis:

| State signal | Tutor behavior |
|---|---|
| `remediate` | Re-explain the prerequisite with a simpler example and a short guided check. |
| `practice` | Offer another closed, scaffolded practice item with immediate feedback. |
| `retrieve` | Schedule or suggest retrieval practice before introducing new complexity. |
| `continue` | Advance while preserving a light comprehension check. |
| High uncertainty or low evidence | Ask a short diagnostic check and avoid claiming mastery or failure. |
| Review due | Prefer spaced retrieval over repeating the exact same item. |

The Tutor must not silently lower a learner's access, label them, or make a
high-stakes decision from a single score. Mastery probability, uncertainty,
and evidence count must be passed to the pedagogical policy together so the
system distinguishes "weak evidence" from "weak performance".

### Closed feedback loop

The future implementation should follow this sequence:

```text
Learner request
  → Core authenticates and resolves safe context
  → Core reads /learn/personalization
  → Tutor policy selects a pedagogical strategy
  → approved Tutor content/model response is moderated
  → learner receives the explanation or practice
  → authoritative grading/progress writes new evidence
  → Data Intel recomputes skill state
```

Any new Tutor telemetry must use a closed event vocabulary, bounded numeric
or identifier fields, idempotency keys, and the existing consent gate. Adding
an event requires a migration, Core emission path, tests, and documentation;
the Tutor must never create an arbitrary JSON or free-text analytics channel.
The useful learning outcome remains the server-authoritative attempt record,
not a model's interpretation of what the learner typed.

### Safety, privacy, and failure posture

- A child-facing Tutor requires moderation before display, rate limits, audit
  logging, and a safe fallback when Data Intel or the model is unavailable.
- The Tutor must be transparent when evidence is absent or insufficient and
  fall back to a baseline diagnostic flow rather than inventing a profile.
- Parent visibility into a child's learning activity remains mandatory.
- Consent revocation must stop consent-gated behavioural telemetry; it must
  not be bypassed by the Tutor or by a second analytics path.
- No raw minor PII or free-form child content may leave LittleFounders' own
  infrastructure. Any future live-chat design needs a separate review under
  §1.9 and the moderation-before-screen rule.
- A failed personalization read is not equivalent to an empty state. Core
  must return an explicit degraded response or use a safe generic Tutor mode;
  it must not treat an unavailable warehouse as zero mastery.

### Production acceptance checklist

Before enabling personalized Tutor behavior, a future implementation must
prove all of the following:

- the current Vault migrations and Data Intel service are deployed and synced;
- Core's route authenticates the caller, validates the envelope, and prevents
  cross-user access;
- the model context contains only the approved fields above;
- no raw answers, free text, session replay, or minor PII enters the model;
- low-evidence and unavailable-data paths are tested separately;
- content moderation, refusal, rate limiting, timeout, and fallback behavior
  are tested;
- parent visibility and consent revocation are tested end to end;
- personalization is evaluated with offline pedagogical tests and a staged
  experiment before broad release.

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
