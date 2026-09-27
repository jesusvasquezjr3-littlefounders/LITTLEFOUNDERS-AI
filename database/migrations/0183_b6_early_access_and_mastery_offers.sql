-- @phase: expand
-- B.6 / OD-25 (owner review P-03 and P-04) — the learner's own pathway
-- decisions. Policy: docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md, rules P8
-- (early chapter access) and E3 (Mentor-mastery completion offer).
-- Requires the B.6 data layer (0123) and route adoption (0125).
--
-- Two additive, write-once learner tables. Nothing reads them until Core runs
-- with COURSE_PATHWAY_ENGINE=pathway, and that switch needs this migration
-- applied first (the pathway reads fail closed with 502 without it).
--
--   course_chapter_early_access     a minor confirmed opening a chapter ONE
--                                   stage above their own (child to tween,
--                                   tween to teen) after Core found every
--                                   prerequisite skill mastered on the shared
--                                   graph. Never an adult chapter, never two
--                                   stages up: the CHECKs and the insert guard
--                                   refuse both even from the service role.
--                                   Core still re-checks the age half on every
--                                   read (Rule P8), so a stored row never
--                                   outlives the safeguard.
--   course_topic_mastery_decisions  the learner's answer to "You have shown
--                                   mastery of X; complete this topic?". An
--                                   accepted row completes the topic (E3); a
--                                   declined row stops the offer for good.
--                                   The KCs the offer named are kept as the
--                                   evidence it rested on.
--
-- POSTURE (0123's): Core writes with the service role; no client INSERT,
-- UPDATE or DELETE privilege or policy exists. The learner and a verified
-- guardian read the learner's rows. Rows are never updated (the first
-- decision is final; a replay is ignored by the primary key). They are
-- deleted only with the account (ON DELETE CASCADE from auth.users, E.6).
-- Each row references ONE account and holds no free text, so neither table is
-- a messaging surface (E.10, 0121).

-- ─────────────────────────────────────────────────────────────
-- course_chapter_early_access — Rule P8
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_chapter_early_access (
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id        uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    adventure_id     uuid NOT NULL REFERENCES public.adventures (id) ON DELETE CASCADE,
    -- The chapter's stage and the learner's stage when they confirmed. Only
    -- the two one-stage-up pairs exist; 'adult' is not a possible value.
    pathway_stage    text NOT NULL CHECK (pathway_stage IN ('tween', 'teen')),
    learner_stage    text NOT NULL CHECK (learner_stage IN ('child', 'tween')),
    -- The prerequisite KC keys that were satisfied at confirmation.
    prerequisite_kcs text[] NOT NULL,
    confirmed_at     timestamptz NOT NULL DEFAULT now(),
    recorded_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, adventure_id),
    CONSTRAINT course_chapter_early_access_one_stage CHECK (
        (learner_stage = 'child' AND pathway_stage = 'tween')
        OR (learner_stage = 'tween' AND pathway_stage = 'teen')
    ),
    CONSTRAINT course_chapter_early_access_has_evidence CHECK (
        cardinality(prerequisite_kcs) BETWEEN 1 AND 500
        AND array_position(prerequisite_kcs, NULL) IS NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_course_chapter_early_access_course
    ON public.course_chapter_early_access (user_id, course_id);

ALTER TABLE public.course_chapter_early_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_chapter_early_access_select_own ON public.course_chapter_early_access;
CREATE POLICY course_chapter_early_access_select_own ON public.course_chapter_early_access
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- The chapter must belong to the course, be published, and have exactly the
-- stage the row names (explicit pathway_stage, else the legacy age_tier map
-- of Rule P1: tier1/tier2 child, tier3 tween, tier4 teen). An adult chapter
-- can therefore never be recorded.
CREATE OR REPLACE FUNCTION public.guard_course_chapter_early_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    chapter_stage text;
BEGIN
    SELECT COALESCE(a.pathway_stage,
                    CASE a.age_tier WHEN 'tier1' THEN 'child' WHEN 'tier2' THEN 'child'
                                    WHEN 'tier3' THEN 'tween' WHEN 'tier4' THEN 'teen' END)
      INTO chapter_stage
      FROM public.adventures a
     WHERE a.id = NEW.adventure_id AND a.course_id = NEW.course_id AND a.status = 'published';
    IF chapter_stage IS NULL THEN
        RAISE EXCEPTION 'EARLY_ACCESS_CHAPTER_INVALID' USING ERRCODE = 'check_violation';
    END IF;
    IF chapter_stage IS DISTINCT FROM NEW.pathway_stage THEN
        RAISE EXCEPTION 'EARLY_ACCESS_STAGE_MISMATCH' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_chapter_early_access_guard ON public.course_chapter_early_access;
CREATE TRIGGER course_chapter_early_access_guard
    BEFORE INSERT ON public.course_chapter_early_access
    FOR EACH ROW EXECUTE FUNCTION public.guard_course_chapter_early_access();

-- ─────────────────────────────────────────────────────────────
-- course_topic_mastery_decisions — Rule E3
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_topic_mastery_decisions (
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id   uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    topic_id    uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    decision    text NOT NULL CHECK (decision IN ('accepted', 'declined')),
    -- The KC keys the offer named: every one held by the Mentor at its 0.80
    -- bar when the learner answered.
    kcs         text[] NOT NULL,
    decided_at  timestamptz NOT NULL DEFAULT now(),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id),
    CONSTRAINT course_topic_mastery_decisions_has_evidence CHECK (
        cardinality(kcs) BETWEEN 1 AND 200
        AND array_position(kcs, NULL) IS NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_course_topic_mastery_decisions_course
    ON public.course_topic_mastery_decisions (user_id, course_id);

ALTER TABLE public.course_topic_mastery_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_topic_mastery_decisions_select_own ON public.course_topic_mastery_decisions;
CREATE POLICY course_topic_mastery_decisions_select_own ON public.course_topic_mastery_decisions
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- The topic must belong to the course and every named KC must be an ACTIVE
-- shared KC: a draft KC does not exist for a learner (0123 posture).
CREATE OR REPLACE FUNCTION public.guard_course_topic_mastery_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM public.topics t
          JOIN public.sagas s ON s.id = t.saga_id
          JOIN public.adventures a ON a.id = s.adventure_id
         WHERE t.id = NEW.topic_id AND a.course_id = NEW.course_id
    ) THEN
        RAISE EXCEPTION 'MASTERY_DECISION_TOPIC_INVALID' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(NEW.kcs) AS named(key)
         WHERE NOT EXISTS (SELECT 1 FROM public.kc WHERE kc.key = named.key AND kc.status = 'active')
    ) THEN
        RAISE EXCEPTION 'MASTERY_DECISION_KC_INVALID' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_topic_mastery_decisions_guard ON public.course_topic_mastery_decisions;
CREATE TRIGGER course_topic_mastery_decisions_guard
    BEFORE INSERT ON public.course_topic_mastery_decisions
    FOR EACH ROW EXECUTE FUNCTION public.guard_course_topic_mastery_decision();

-- ─────────────────────────────────────────────────────────────
-- Write-once: a decision is never edited, by any role
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refuse_b6_learner_decision_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'B6_LEARNER_DECISION_IMMUTABLE' USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS course_chapter_early_access_immutable ON public.course_chapter_early_access;
CREATE TRIGGER course_chapter_early_access_immutable
    BEFORE UPDATE ON public.course_chapter_early_access
    FOR EACH ROW EXECUTE FUNCTION public.refuse_b6_learner_decision_update();

DROP TRIGGER IF EXISTS course_topic_mastery_decisions_immutable ON public.course_topic_mastery_decisions;
CREATE TRIGGER course_topic_mastery_decisions_immutable
    BEFORE UPDATE ON public.course_topic_mastery_decisions
    FOR EACH ROW EXECUTE FUNCTION public.refuse_b6_learner_decision_update();

-- ─────────────────────────────────────────────────────────────
-- Privileges: browsers read (RLS decides whose rows), only Core writes
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.course_chapter_early_access FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.course_topic_mastery_decisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.course_chapter_early_access TO authenticated;
GRANT SELECT ON TABLE public.course_topic_mastery_decisions TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.course_chapter_early_access TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.course_topic_mastery_decisions TO service_role;

REVOKE ALL ON FUNCTION public.guard_course_chapter_early_access() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_course_topic_mastery_decision() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refuse_b6_learner_decision_update() FROM PUBLIC, anon, authenticated, service_role;
