-- @phase: expand
-- 0066_tutor_trajectory.sql — the Tutor V4 harness backlog, first slice:
-- TRAJECTORY EMISSION. A durable, queryable, per-turn record of what the
-- deterministic pedagogical controller (oracle/src/tutor/controller.ts)
-- actually decided during a real session, so it can be studied offline.
--
-- Authoritative design: /ORACLE.md §20 (V4, the bicameral tutor). ROADMAP.md's
-- "Remaining harness phases" line names trajectory emission as backlog, gated
-- on the harness doc's own §15.1: "nothing autonomous reaches a child." This
-- migration adds NO new reach to a model and NO new surface a learner sees —
-- it is backstage-only, a record OF the controller, never an input TO it.
--
-- WHAT THIS ADDS AND WHY.
--
--   tutor_trajectory_step   One row per `PedagogicalController.decide()` call
--                           that actually happened in a real session: which
--                           strategy was in force before, which one was
--                           chosen, which skill (if any) delivered it, the
--                           scaffolding/difficulty bands, the mastery
--                           estimate and diagnosed misconception (if any) the
--                           decision was made on, and which knowledge
--                           component it was about. Emitted fire-and-forget
--                           after a session ends (`oracle/src/session/
--                           trajectory.ts`, the same seam `runPostSessionReview`
--                           already uses for the learner-memory write) — never
--                           on the live turn path, so nothing here can add
--                           latency to a spoken turn.
--
-- WHY A NEW TABLE RATHER THAN REUSING `kc_attempt` (0052) OR `learning_events`
-- (0023). `kc_attempt` is the EVIDENCE ledger for GRADED attempts only — it
-- has no row at all for the `conversation_turn` events that V4 sprint 1 found
-- were, by count, MOST of a session (§20.2: the brain used to never even see
-- them). It also carries no `skill_name` and no `strategy_before`, so the
-- SEQUENCE of decisions — the exact thing `verify:pedagogy` exists to protect
-- because a sequence-level defect is invisible to a check on any one row —
-- cannot be reconstructed from it. `learning_events` is a fixed, already-wide
-- enum owned by the general analytics warehouse (Data Intel); widening it for
-- a harness-only, backstage concern would couple two unrelated consumers to
-- one schema. A dedicated table keeps the harness's own evolution (more
-- fields, a different retention story) from ever being a `learning_events`
-- migration.
--
-- §13 OF /ORACLE.md ("closed vocabulary, or nothing — the tutor must never
-- create an arbitrary JSON or free-text analytics channel") is why this is
-- ROWS of bounded, typed, CHECK-constrained columns and not one JSONB blob
-- per session. Every enum here is the SAME closed vocabulary the model
-- context and `kc_attempt` already use (`strategy` matches `kc_attempt`'s own
-- CHECK list verbatim); `skill_name` and `misconception_code` are bounded
-- identifier-shaped text, never free prose, exactly like every other
-- identifier column in this schema.
--
-- IDEMPOTENCY. `UNIQUE (session_id, turn_seq)` plus the writer's own
-- `on_conflict=session_id,turn_seq&resolution=ignore-duplicates` (the same
-- PostgREST idiom `insertTutorTurn` already uses against `tutor_turns`) is
-- required, not decorative: `ws/server.ts`'s two close paths (`finish()` and
-- `finalizeParked()`) can BOTH fire their own post-session work for the same
-- session on a documented race (see that file's own comment on
-- `runPostSessionReview`, and RUNBOOK.md) — so a trajectory batch may be
-- POSTed twice for one session. Both attempts carry byte-identical rows (the
-- orchestrator's own in-memory step log, read twice), so ignore-duplicates
-- makes a double-fire a safe no-op rather than a duplicate audit trail.
--
-- POSTURE. Same as 0014/0015/0017/0020/0021/0045 and 0052's own
-- `misconception`: RLS enabled, ZERO client policies. This is deliberately
-- NOT guardian-readable like `kc_attempt`/`learner_memory` — those already
-- give a parent the pedagogically meaningful facts (mastery, attempts,
-- correctness); this table is an internal engineering/research artifact
-- about the CONTROLLER's own state machine, the same posture as a system log,
-- with no learner-facing or parent-facing surface built against it in this
-- pass. Only the service role (Core) may read or write it.
--
-- WHAT IS DELIBERATELY ABSENT. No raw learner text, no tutor `say` text, no
-- audio reference — those already live in `tutor_turns` under its own
-- retention policy. `session_id` is nullable with `ON DELETE SET NULL` (not
-- CASCADE), exactly like `kc_attempt.session_id`: a trajectory row is
-- evidence about the CONTROLLER, and must outlive the 90-day session purge
-- the same way `kc_attempt` already does, or a harness study run six weeks
-- from now finds nothing.

CREATE TABLE IF NOT EXISTS public.tutor_trajectory_step (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id         uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- The orchestrator's own per-session decision ordinal (NOT tutor_turns.seq
    -- and NOT the transcript row count — see oracle/src/session/trajectory.ts
    -- for why a dedicated counter was chosen over either existing one).
    turn_seq           integer NOT NULL CHECK (turn_seq >= 1),
    event_kind         text NOT NULL CHECK (event_kind IN
                           ('activity_result', 'voice_result', 'conversation_turn', 'entry_opened')),
    -- The strategy in force immediately BEFORE this decision. Never NULL:
    -- `PedagogicalController`'s constructor seeds a real strategy synchronously
    -- from the session plan's first entry, so by the time `decide()` can be
    -- called at all (the controller is `active`, i.e. the plan is non-empty)
    -- a "before" value always already exists.
    strategy_before    text NOT NULL CHECK (strategy_before IN
                           ('DIRECT', 'WORKED', 'FADED', 'SOCRATIC', 'FLUENCY', 'SPACED',
                            'PROBE', 'REMEDIATE', 'RESCUE', 'ELABORATE', 'TRANSFER', 'CELEBRATE')),
    -- The strategy this decision chose. Same closed vocabulary as kc_attempt.strategy (0052).
    strategy           text NOT NULL CHECK (strategy IN
                           ('DIRECT', 'WORKED', 'FADED', 'SOCRATIC', 'FLUENCY', 'SPACED',
                            'PROBE', 'REMEDIATE', 'RESCUE', 'ELABORATE', 'TRANSFER', 'CELEBRATE')),
    -- The pedagogical skill (oracle/skills/moves/*.md) that carried this
    -- decision's procedure, or NULL when none matched and the one-line
    -- STRATEGY_INSTRUCTIONS fallback was used instead (a catalogue gap).
    skill_name         text NULL CHECK (skill_name IS NULL OR char_length(skill_name) BETWEEN 1 AND 64),
    scaffolding        smallint NOT NULL CHECK (scaffolding BETWEEN 0 AND 3),
    difficulty         smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    -- The controller's own BKT-mirror mastery estimate this decision was made
    -- on. NULL only when the controller was inactive (never actually written,
    -- since the emitter skips inactive-controller sessions entirely — kept
    -- nullable so a future event kind that legitimately lacks one is not a
    -- schema change).
    p_known            numeric(6,5) NULL CHECK (p_known IS NULL OR (p_known >= 0 AND p_known <= 1)),
    -- The catalogued misconception code diagnosed at decision time, or NULL.
    -- A bounded identifier (database/migrations/0052's `misconception.code`
    -- shape), never the learner's own words.
    misconception_code text NULL CHECK (misconception_code IS NULL OR char_length(misconception_code) BETWEEN 1 AND 64),
    kc_id              uuid NULL REFERENCES public.kc (id) ON DELETE SET NULL,
    kc_mode            text NULL CHECK (kc_mode IS NULL OR kc_mode IN ('new', 'review', 'probe', 'remediation')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    -- Idempotency key — see the migration header's own note on the documented
    -- finish()/finalizeParked() double-fire race.
    UNIQUE (session_id, turn_seq)
);

CREATE INDEX IF NOT EXISTS idx_tutor_trajectory_step_user_created
    ON public.tutor_trajectory_step (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_trajectory_step_kc
    ON public.tutor_trajectory_step (kc_id) WHERE kc_id IS NOT NULL;

ALTER TABLE public.tutor_trajectory_step ENABLE ROW LEVEL SECURITY;
-- No client policy, by design (see the header's POSTURE note) — only the
-- service role (which bypasses RLS) may read or write this table.
