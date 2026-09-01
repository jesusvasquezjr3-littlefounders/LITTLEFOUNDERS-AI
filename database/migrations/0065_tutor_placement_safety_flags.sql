-- 0065_tutor_placement_safety_flags.sql — a flagged placement-intake
-- utterance was a loud server log and nothing else: no guardian could ever
-- see it, because `tutor_safety_flags` requires a `session_id` and placement
-- happens before any `tutor_sessions` row exists.
-- @phase: expand
--
-- CLOSES THE GAP /ORACLE.md §4.1b NAMED EXPLICITLY (found by adversarial
-- review, 2026-08-30, HIGH; left open on purpose): "whether a flagged
-- placement-intake utterance belongs in a guardian-visible record the way a
-- live-session safety flag does is a separate schema decision ...
-- tutor_safety_flags requires a session_id FK and placement has no session
-- to attach one to. A loud log is the floor this fix guarantees, not the
-- ceiling." This migration is that schema decision.
--
-- WHY A SEPARATE TABLE RATHER THAN A NULLABLE `tutor_safety_flags.session_id`.
-- The two provenances are not the same shape with one optional field —
-- placement carries no `turn_seq` (there is no transcript to point a
-- guardian's "read it in context" button into) and no meaningful `handled`
-- value (`runPlacementIntake`, oracle/src/tutor/placementIntake.ts, takes
-- exactly ONE path on a flagged utterance — the neutral fallback — never
-- `turn_blocked`/`session_stopped`, which describe an in-session repair
-- mechanism placement does not have at all). Widening `tutor_safety_flags`
-- to fit both would mean every one of its readers — the 90-day retention
-- CASCADE off `tutor_sessions`, the recall-exclusion joins in
-- 0054/0056_recall_*.sql, the guardian transcript viewer that expects a real
-- `session_id`/`turn_seq` pair to highlight — has to learn a second, sparser
-- row shape sharing its table, forever. A dedicated table keeps both shapes
-- honest and touches NONE of that surface: zero changes to 0047, 0054, 0056.
--
-- WHAT PLACEMENT HAS INSTEAD. `course_id` (which course the learner was
-- placing into when it happened — real, useful context, no PII) stands in
-- for `session_id`/`turn_seq`, and there is no `handled` column at all,
-- since there is exactly one way this is ever handled today. `category`/
-- `severity` are copied verbatim from `classifyLearnerInput`'s six-value
-- enum (oracle/src/safety/classifier.ts) — never `model_output_blocked`,
-- because placement intake only ever classifies the LEARNER's own words,
-- never a model reply — so the CHECK below is deliberately narrower than
-- `tutor_safety_flags.category`, which also guards output-side blocks.
--
-- RETENTION IS DELIBERATELY LEFT UNDECIDED HERE, not overlooked: unlike
-- `tutor_safety_flags`, this table has no `tutor_sessions` row to cascade
-- off, so /ORACLE.md §12's 90-day sweep does not reach it, and inventing a
-- time-based purge for a guardian safety record is a product decision this
-- migration does not make unilaterally. Revisit alongside §12 if that
-- changes; today it behaves like `learner_memory_ledger` (0053) — an
-- append-only safety record that outlives session retention on purpose.
CREATE TABLE IF NOT EXISTS public.tutor_placement_safety_flags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- Context, not ownership: a course being removed from the catalog must
    -- never take a guardian-visible safety record down with it.
    course_id   uuid NULL REFERENCES public.courses (id) ON DELETE SET NULL,
    category    text NOT NULL CHECK (category IN
                    ('self_harm', 'abuse_disclosure', 'adult_content',
                     'grooming_pattern', 'personal_data', 'injection_attempt')),
    -- Deliberately NOT the utterance — same posture as tutor_safety_flags
    -- (0047): a flag is a signal to a guardian, not a second unregulated
    -- copy of what a distressed learner typed.
    severity    text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_placement_safety_flags_user
    ON public.tutor_placement_safety_flags (user_id, created_at DESC);

ALTER TABLE public.tutor_placement_safety_flags ENABLE ROW LEVEL SECURITY;

-- Identical predicate to tutor_safety_flags_select_own (0047): a child
-- disclosing distress while choosing a course is exactly the case where a
-- parent must find out, same as one disclosed mid-session.
DROP POLICY IF EXISTS tutor_placement_safety_flags_select_own ON public.tutor_placement_safety_flags;
CREATE POLICY tutor_placement_safety_flags_select_own ON public.tutor_placement_safety_flags
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
