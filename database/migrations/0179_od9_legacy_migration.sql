-- od9_legacy_migration — S10.1 (OD-9, OD-24): the two durable records the
-- legacy-data migration leaves behind in the product schema.
-- @phase: expand
--
-- Toolkit and procedure: database/migration-od9/README.md. Lane record:
-- docs/rebuild/sprints/S10-CUTOVER.md. Policy for the KC credit:
-- docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md (sections 6 and 7).
--
-- 1. legacy_kc_credits (OD-24). The legacy lesson catalog is replaced by new
--    courses. Before it goes, the OD-9 toolkit writes one row per (learner,
--    knowledge component, completed legacy topic that TEACHES it): the topic
--    was complete under Rule E1 (every published lesson passed or
--    placement-credited). The row survives the content: it keeps the topic's
--    id, course slug and path as plain values, not foreign keys, so removing
--    the legacy topic never removes the credit. Core reads it as course
--    evidence (Rule E2), so a new course starts the learner past what they
--    already completed. It never completes a new topic by itself: that needs
--    a reviewed lesson equivalence (same component, same or older stage
--    content, legacy_kc_credit_covers below). Rows are written once by the
--    service role and never updated or deleted by any product path.
--
-- 2. data_practices and data_practice_consents (owner log section 4.2).
--    Parental consent carries over only for the practices it covered. Every
--    data practice the rebuild introduced is listed in data_practices with
--    the consent it needs; data_practice_consents records a specific consent
--    per (child, practice). has_data_practice_consent answers the question a
--    consumer asks before applying a practice to a migrated child. The
--    toolkit marks which migrated children lack each consent. Rows are
--    written by the service role only (Core validates who may grant).
--
-- 3. get_completed_course_badges keeps a stored badge when its course is
--    archived. OD-24 retires the legacy catalog; the 0125 reader filtered the
--    stored half on courses.status = 'published', so archiving a legacy
--    course would have hidden every frozen badge of it from every badge
--    reader (profile, Family Hub, B.2 check), which OD-9 forbids. Same
--    signature and row shape; the live half is unchanged (a live badge still
--    needs a published course). Retiring content means archiving it, never
--    deleting it: lesson_progress, placement_credits and course_pathway_badges
--    cascade on delete (README of the toolkit).
--
-- No existing table or column changes; one function body widens what it
-- returns: expand.

-- ─────────────────────────────────────────────────────────────
-- legacy_kc_credits
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legacy_kc_credits (
    user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kc_id              uuid NOT NULL REFERENCES public.kc (id) ON DELETE RESTRICT,
    source_topic_id    uuid NOT NULL,
    source_course_slug text NOT NULL CHECK (char_length(source_course_slug) BETWEEN 1 AND 128),
    source_topic_path  text NOT NULL CHECK (char_length(source_topic_path) BETWEEN 1 AND 400),
    source_stage       text NOT NULL CHECK (source_stage IN ('child', 'tween', 'teen', 'adult')),
    basis              text NOT NULL CHECK (basis IN ('lessons_passed', 'placement_credit', 'mixed')),
    lessons_total      integer NOT NULL CHECK (lessons_total >= 1),
    completed_at       timestamptz,
    map_version        smallint NOT NULL CHECK (map_version >= 1),
    credited_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kc_id, source_topic_id)
);
CREATE INDEX IF NOT EXISTS legacy_kc_credits_kc ON public.legacy_kc_credits (kc_id);

ALTER TABLE public.legacy_kc_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_kc_credits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.legacy_kc_credits TO authenticated;
GRANT SELECT, INSERT ON public.legacy_kc_credits TO service_role;

DROP POLICY IF EXISTS legacy_kc_credits_select_own ON public.legacy_kc_credits;
CREATE POLICY legacy_kc_credits_select_own ON public.legacy_kc_credits
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- The equivalence rule of S05-B6-PATHWAY-POLICY section 6: legacy evidence
-- may stand for new content only for the same knowledge component and when
-- the legacy content was of the same or an older stage (an older stage
-- teaches more depth; a childhood topic never stands for a teen one, T3).
CREATE OR REPLACE FUNCTION public.legacy_kc_credit_covers(p_user_id uuid, p_kc_id uuid, p_stage text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.legacy_kc_credits c
        WHERE c.user_id = p_user_id
          AND c.kc_id = p_kc_id
          AND array_position(ARRAY['child', 'tween', 'teen', 'adult'], c.source_stage)
              >= array_position(ARRAY['child', 'tween', 'teen', 'adult'], p_stage)
    )
$$;
REVOKE ALL ON FUNCTION public.legacy_kc_credit_covers(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_kc_credit_covers(uuid, uuid, text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- data_practices — the registry of practices the rebuild introduced
-- ─────────────────────────────────────────────────────────────
-- introduced_by names the migration by its suffix, never its number (numbers
-- are renumbered at merge). consent_source says where a specific consent is
-- recorded: this migration's data_practice_consents, or the D.22 research
-- consent that already exists for exactly one practice.
CREATE TABLE IF NOT EXISTS public.data_practices (
    key                text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.-]{2,63}$'),
    kind               text NOT NULL CHECK (kind IN ('analytics_event_class', 'mentor_memory_type', 'sharing_surface', 'learner_record', 'research')),
    introduced_by      text NOT NULL CHECK (introduced_by ~ '^[a-z0-9_]+$'),
    requirement        text NOT NULL CHECK (char_length(requirement) BETWEEN 1 AND 40),
    consent_source     text NOT NULL CHECK (consent_source IN ('data_practice_consents', 'family_research_consents')),
    teen_self_consent  boolean NOT NULL,
    disclosure_version smallint NOT NULL DEFAULT 1 CHECK (disclosure_version >= 1),
    summary            text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 400),
    created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_practices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_practices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.data_practices TO authenticated, service_role;

DROP POLICY IF EXISTS data_practices_select_all ON public.data_practices;
CREATE POLICY data_practices_select_all ON public.data_practices FOR SELECT USING (true);

-- teen_self_consent: whether a self-registered 13-17 with no Tutor may give
-- the consent themselves (H.1's self-managed model). Only analytics classes
-- follow H.1; research (D.22) and every Mentor memory type or sharing surface
-- wait for a verified Tutor, the conservative reading of section 4.2.
INSERT INTO public.data_practices (key, kind, introduced_by, requirement, consent_source, teen_self_consent, summary) VALUES
    ('analytics.learning_quality_events', 'analytics_event_class', 'learning_quality_events', 'B.5', 'data_practice_consents', true,
     'Replay and non-regression display events recorded per learner (Appendix C quality metrics).'),
    ('analytics.motivation_events', 'analytics_event_class', 'motivation_events', 'B.21', 'data_practice_consents', true,
     'Streak, rest-day and autonomy-lever events recorded per learner (Appendix C motivation metrics).'),
    ('analytics.engagement_heartbeats', 'analytics_event_class', 'engagement_health', 'B.28', 'data_practice_consents', true,
     'Visible-tab session heartbeats used for the Session Efficiency Ratio.'),
    ('analytics.family_money_events', 'analytics_event_class', 'family_money_events', 'D.13', 'data_practice_consents', true,
     'What a child does with their coins and when, recorded as analytics events.'),
    ('analytics.achievement_share_initiations', 'analytics_event_class', 'achievement_share_initiations', 'F.1', 'data_practice_consents', true,
     'A record of each achievement share a family starts (Appendix L shares-initiated metric).'),
    ('analytics.mentor_behavioral_telemetry', 'analytics_event_class', 'mentor_behavioral_telemetry', 'C.9', 'data_practice_consents', true,
     'Per-session Mentor behaviour counts and disengagement check-in firings.'),
    ('analytics.mentor_integrity_evidence', 'analytics_event_class', 'mentor_integrity_evidence', 'C.10', 'data_practice_consents', true,
     'Mastery-engine observations and honesty checks logged for each Mentor turn.'),
    ('research.family_longitudinal', 'research', 'family_research_instrumentation', 'D.22', 'family_research_consents', false,
     'Monthly de-identified snapshots for the long-horizon money-behaviour study.'),
    ('mentor.disposition_profile', 'mentor_memory_type', 'mentor_alliance_and_disposition', 'C.7', 'data_practice_consents', false,
     'A persistent learner disposition profile the Mentor keeps across sessions.'),
    ('mentor.alliance_record', 'mentor_memory_type', 'mentor_alliance_and_disposition', 'C.15', 'data_practice_consents', false,
     'Per-session alliance and goal-agreement records the Mentor adapts from.'),
    ('mentor.dialogue_calibration', 'mentor_memory_type', 'mentor_spaced_review_and_dialogue_calibration', 'C.17', 'data_practice_consents', false,
     'Per-learner dialogue calibration and spaced-review routing records.'),
    ('learning.decision_journal', 'learner_record', 'learning_decision_journal', 'B.9', 'data_practice_consents', false,
     'The in-story choices a learner makes, kept and resurfaced later.'),
    ('sharing.social_connections', 'sharing_surface', 'social_connection_requests', 'E.8', 'data_practice_consents', false,
     'The age-tiered social layer: connection requests and profiles visible to approved connections.'),
    ('sharing.learning_family_bridge', 'sharing_surface', 'learning_family_bridge', 'B.13', 'data_practice_consents', false,
     'Course learning surfaced to the family as prompts in the Family Hub.')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- data_practice_consents — one specific consent per (child, practice)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_practice_consents (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    practice_key       text NOT NULL REFERENCES public.data_practices (key) ON DELETE RESTRICT,
    grantor_kind       text NOT NULL CHECK (grantor_kind IN ('tutor', 'self')),
    granted_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    disclosure_version smallint NOT NULL CHECK (disclosure_version >= 1),
    granted_at         timestamptz NOT NULL DEFAULT now(),
    revoked_at         timestamptz,
    revoked_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT data_practice_consent_revocation CHECK (revoked_at IS NOT NULL OR revoked_by IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS data_practice_one_active_consent
    ON public.data_practice_consents (subject_user_id, practice_key) WHERE revoked_at IS NULL;

ALTER TABLE public.data_practice_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_practice_consents FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.data_practice_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE (revoked_at, revoked_by) ON public.data_practice_consents TO service_role;

DROP POLICY IF EXISTS data_practice_consents_select_own ON public.data_practice_consents;
CREATE POLICY data_practice_consents_select_own ON public.data_practice_consents
    FOR SELECT USING (subject_user_id = auth.uid() OR public.is_verified_guardian_of(subject_user_id));

-- True only for an active consent at or above the practice's current
-- disclosure version. An unknown practice key is never consented.
CREATE OR REPLACE FUNCTION public.has_data_practice_consent(p_subject uuid, p_practice text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE((
        SELECT CASE p.consent_source
            WHEN 'data_practice_consents' THEN EXISTS (
                SELECT 1 FROM public.data_practice_consents c
                WHERE c.subject_user_id = p_subject AND c.practice_key = p.key
                  AND c.revoked_at IS NULL AND c.disclosure_version >= p.disclosure_version)
            WHEN 'family_research_consents' THEN EXISTS (
                SELECT 1 FROM public.family_research_consents r
                WHERE r.subject_user_id = p_subject AND r.revoked_at IS NULL)
            ELSE false
        END
        FROM public.data_practices p
        WHERE p.key = p_practice
    ), false)
$$;
REVOKE ALL ON FUNCTION public.has_data_practice_consent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_data_practice_consent(uuid, text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- get_completed_course_badges — a frozen badge outlives its course's retirement
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_completed_course_badges(
    p_user_id uuid
)
RETURNS TABLE (
    course_slug text,
    course_title jsonb,
    badge_asset text,
    completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH live AS (
        SELECT
            c.id AS course_id,
            MAX(COALESCE(lp.completed_at, pc.created_at)) AS completed_at
        FROM public.courses c
        JOIN public.adventures a ON a.course_id = c.id
        JOIN public.sagas s ON s.adventure_id = a.id
        JOIN public.topics t ON t.saga_id = s.id
        JOIN public.lessons l ON l.topic_id = t.id
        LEFT JOIN public.lesson_progress lp
            ON lp.lesson_id = l.id
           AND lp.user_id = p_user_id
           AND lp.passed = true
        LEFT JOIN public.placement_credits pc
            ON pc.lesson_id = l.id
           AND pc.user_id = p_user_id
        WHERE c.status = 'published'
          AND c.badge_asset IS NOT NULL
          AND l.status <> 'archived'
        GROUP BY c.id
        HAVING COUNT(DISTINCT l.id) > 0
           AND COUNT(DISTINCT COALESCE(lp.lesson_id, pc.lesson_id)) = COUNT(DISTINCT l.id)
    ),
    stored AS (
        SELECT b.course_id, MIN(b.earned_at) AS completed_at
        FROM public.course_pathway_badges b
        JOIN public.courses c ON c.id = b.course_id
        WHERE b.user_id = p_user_id
          AND c.status IN ('published', 'archived')
        GROUP BY b.course_id
    ),
    earned AS (
        SELECT course_id, completed_at FROM live
        UNION ALL
        SELECT course_id, completed_at FROM stored
    )
    SELECT
        c.slug,
        c.title,
        c.badge_asset,
        MIN(e.completed_at) AS completed_at
    FROM earned e
    JOIN public.courses c ON c.id = e.course_id
    WHERE c.badge_asset IS NOT NULL
    GROUP BY c.id, c.slug, c.title, c.badge_asset, c.position
    ORDER BY MIN(e.completed_at) DESC NULLS LAST, c.position ASC, c.id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_completed_course_badges(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_course_badges(uuid) TO service_role;

SELECT 'migration_od9_legacy_migration_ok' AS sentinel;
