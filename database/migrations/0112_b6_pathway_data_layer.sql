-- @phase: expand
-- B.6 / OD-16 / OD-22 (S05.3a) — the data layer of the age-pathway model on
-- the Mentor's shared knowledge-component graph. Policy (a proposal awaiting
-- owner review): docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md.
--
-- Four additive pieces, none read by a learner route yet (S05.3b adopts them):
--
--   topic_knowledge_components  which shared KCs each topic teaches or reviews.
--                               The ONLY bridge between the course catalog and
--                               the Mentor graph; the course engine owns no
--                               competency model of its own (B.6).
--   adventures.pathway_*        explicit stage and age eligibility for new
--                               chapters. NULL on every legacy row, whose
--                               policy Core derives from age_tier (Rule P1).
--   course_pathway_placements   the entry placement of each (course, stage)
--                               pathway. course_placements keeps one row per
--                               course and stays the legacy record (Rule P6).
--   course_pathway_badges       earned course credentials, frozen when earned.
--                               get_completed_course_badges (0039/0043) derives
--                               badges live, so adding one lesson to a finished
--                               course silently revokes every badge on it; OD-9
--                               forbids that, and Rule B4 needs a record.
--
-- POSTURE (0052's): Core writes with the service role; no client INSERT,
-- UPDATE or DELETE policy exists. Learners and verified guardians read their
-- own learner rows; the topic map is curriculum, readable only for ACTIVE KCs
-- so draft KCs stay invisible until the owner accepts the policy.

-- ─────────────────────────────────────────────────────────────
-- topic_knowledge_components — topic → shared KC links
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.topic_knowledge_components (
    topic_id    uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    -- RESTRICT: a mapped KC is retired (status), never deleted out from under
    -- the catalog. 0052's learner tables cascade; a curriculum link must not.
    kc_id       uuid NOT NULL REFERENCES public.kc (id) ON DELETE RESTRICT,
    role        text NOT NULL CHECK (role IN ('teaches', 'reviews')),
    is_primary  boolean NOT NULL DEFAULT false,
    map_version smallint NOT NULL CHECK (map_version >= 1),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (topic_id, kc_id),
    CONSTRAINT topic_kc_primary_teaches CHECK (NOT is_primary OR role = 'teaches')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_topic_kc_one_primary
    ON public.topic_knowledge_components (topic_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_topic_kc_kc
    ON public.topic_knowledge_components (kc_id, role);

ALTER TABLE public.topic_knowledge_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS topic_knowledge_components_select_active ON public.topic_knowledge_components;
CREATE POLICY topic_knowledge_components_select_active ON public.topic_knowledge_components
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.kc
        WHERE kc.id = topic_knowledge_components.kc_id AND kc.status = 'active'
    ));

-- ─────────────────────────────────────────────────────────────
-- adventures — explicit pathway stage and age eligibility (new chapters)
-- ─────────────────────────────────────────────────────────────
-- All three NULL = legacy chapter, policy derived from age_tier. Any one set
-- means all of stage and minimum are required (Core also refuses a half row
-- and treats it as closed; this CHECK stops it being written at all).
ALTER TABLE public.adventures
    ADD COLUMN IF NOT EXISTS pathway_stage text NULL
        CHECK (pathway_stage IS NULL OR pathway_stage IN ('child', 'tween', 'teen', 'adult')),
    ADD COLUMN IF NOT EXISTS eligibility_min_age smallint NULL
        CHECK (eligibility_min_age IS NULL OR eligibility_min_age BETWEEN 0 AND 119),
    ADD COLUMN IF NOT EXISTS eligibility_max_age smallint NULL
        CHECK (eligibility_max_age IS NULL OR eligibility_max_age BETWEEN 0 AND 119);

DO $$
BEGIN
    ALTER TABLE public.adventures
        ADD CONSTRAINT adventures_pathway_eligibility_complete CHECK (
            (pathway_stage IS NULL AND eligibility_min_age IS NULL AND eligibility_max_age IS NULL)
            OR (pathway_stage IS NOT NULL AND eligibility_min_age IS NOT NULL
                AND (eligibility_max_age IS NULL OR eligibility_max_age >= eligibility_min_age))
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- course_pathway_placements — the graph entry point per (course, stage)
-- ─────────────────────────────────────────────────────────────
-- Placement becomes the entry into the shared graph for ONE pathway stage
-- (Rule P6). A learner who ages into a new stage gets a new entry placement;
-- the earlier stage's row and its credits (placement_credits) are kept.
CREATE TABLE IF NOT EXISTS public.course_pathway_placements (
    user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id       uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    pathway_stage   text NOT NULL CHECK (pathway_stage IN ('child', 'tween', 'teen', 'adult')),
    method          text NOT NULL CHECK (method IN (
                        'adaptive_quiz', 'learner_chose_start', 'learner_adjusted',
                        'no_probe_content_fallback', 'legacy_course_placement')),
    start_topic_id  uuid NULL REFERENCES public.topics (id) ON DELETE SET NULL,
    credited_topics integer NOT NULL DEFAULT 0 CHECK (credited_topics >= 0),
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id, pathway_stage)
);

ALTER TABLE public.course_pathway_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_pathway_placements_select_own ON public.course_pathway_placements;
CREATE POLICY course_pathway_placements_select_own ON public.course_pathway_placements
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- course_pathway_badges — earned course credentials, never revoked
-- ─────────────────────────────────────────────────────────────
-- pathway_stage NULL + basis 'legacy_full_course' = a badge earned under the
-- pre-pathway rule (every lesson of the course passed or credited). Rows are
-- inserted once and never updated or deleted by any Core path (Rule B4).
CREATE TABLE IF NOT EXISTS public.course_pathway_badges (
    user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id     uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    award_key     text NOT NULL CHECK (award_key IN ('legacy', 'child', 'tween', 'teen', 'adult')),
    pathway_stage text NULL CHECK (pathway_stage IS NULL OR pathway_stage IN ('child', 'tween', 'teen', 'adult')),
    basis         text NOT NULL CHECK (basis IN ('legacy_full_course', 'own_stage', 'younger_bridge', 'older_early')),
    earned_at     timestamptz NOT NULL,
    recorded_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id, award_key),
    CONSTRAINT course_pathway_badges_key_matches CHECK (
        (basis = 'legacy_full_course' AND award_key = 'legacy')
        OR (basis <> 'legacy_full_course' AND pathway_stage IS NOT NULL AND award_key = pathway_stage)
    )
);

ALTER TABLE public.course_pathway_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_pathway_badges_select_own ON public.course_pathway_badges;
CREATE POLICY course_pathway_badges_select_own ON public.course_pathway_badges
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- Freeze every badge the live rule grants today, so the catalog expansion
-- OD-16 plans can never take one away. Idempotent: re-running inserts nothing.
-- The legacy stage is recorded when every chapter of the course shares one
-- (financial-education and first-lemonade-stand: child; investing and
-- entrepreneurship: teen), NULL otherwise.
INSERT INTO public.course_pathway_badges (user_id, course_id, award_key, pathway_stage, basis, earned_at)
SELECT learners.user_id,
       c.id,
       'legacy',
       stages.legacy_stage,
       'legacy_full_course',
       COALESCE(badge.completed_at, now())
FROM (
    SELECT user_id FROM public.lesson_progress WHERE passed
    UNION
    SELECT user_id FROM public.placement_credits
) AS learners
CROSS JOIN LATERAL public.get_completed_course_badges(learners.user_id) AS badge
JOIN public.courses c ON c.slug = badge.course_slug
LEFT JOIN LATERAL (
    SELECT CASE
        WHEN bool_and(a.age_tier IN ('tier1', 'tier2')) THEN 'child'
        WHEN bool_and(a.age_tier = 'tier3') THEN 'tween'
        WHEN bool_and(a.age_tier = 'tier4') THEN 'teen'
        ELSE NULL
    END AS legacy_stage
    FROM public.adventures a
    WHERE a.course_id = c.id
) AS stages ON true
ON CONFLICT (user_id, course_id, award_key) DO NOTHING;
