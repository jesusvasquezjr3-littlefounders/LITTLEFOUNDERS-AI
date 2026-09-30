-- decision_journal_coverage — the coverage half of Appendix C 1.1's
-- "Decision Journal Coverage & Resurfacing Rate" (B.9; GAP-FIX-R7 learning).
-- @phase: expand
--
-- Appendix C 1.1 asks for the "% of meaningful in-story choices that are
-- recorded ... and of those, % later resurfaced". learning_narrative_metrics
-- (*_learning_family_bridge.sql) returned only the journal's own rows
-- (recorded, resurfaced): it had no count of the choices the learners MADE, so
-- a journal write that failed (the write is best-effort by design, so a failed
-- one never costs a grade) was invisible. This adds the denominator.
--
--   story_decisions_made       distinct (learner, lesson, segment) story
--                              decisions graded in the window: v1 attempts
--                              (lesson_segment_attempts) on a segment the
--                              journal records (a story_branch with a node
--                              offering two or more choices, a
--                              dialogue_choice turn with two or more replies,
--                              a would_you_rather), plus v2 grade receipts on
--                              a story.branch.v2, story.dialogue-choice.v2 or
--                              story.would-you-rather.v2 segment of the
--                              document version the receipt names. A replay
--                              counts once; a decision graded on both engines
--                              counts once.
--   story_decisions_journaled  the ones with a learner_decision_journal row
--                              for that learner, lesson and segment.
--   story_decisions_without_consent
--                              decisions of learners for whom the
--                              learning.decision_journal practice does not
--                              apply today (a migrated child without the
--                              specific consent, OD-9): the consent trigger
--                              drops their journal rows by design, so they are
--                              reported apart and never count as lost.
--
-- Coverage = journaled / made. It is diagnostic (Appendix C: no fixed target);
-- the first release window is its baseline. The keys the function already
-- returned are unchanged.
--
-- POSTURE: every function here is SECURITY DEFINER, executable by service_role only.
-- The metric returns counts, never a learner id.

-- A JSON value as an array: itself when it is one, else the empty array (a
-- malformed document is never an error in a metric).
CREATE OR REPLACE FUNCTION public.learning_json_array(p_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE WHEN jsonb_typeof(p_value) = 'array' THEN p_value ELSE '[]'::jsonb END;
$$;

REVOKE ALL ON FUNCTION public.learning_json_array(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_json_array(jsonb) TO service_role;

-- Is this lesson-document segment one of the journal's story decisions? The
-- same classification Core's decisionJournal.ts applies (STORY_DECISION_TYPES,
-- V2_STORY_DECISION_TYPES): a one-choice story node advances the story and is
-- not a decision.
CREATE OR REPLACE FUNCTION public.learning_story_decision_segment(p_segment jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE p_segment ->> 'type'
        WHEN 'story_branch' THEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(public.learning_json_array(p_segment #> '{payload,nodes}')) n
            WHERE jsonb_array_length(public.learning_json_array(n -> 'choices')) >= 2)
        WHEN 'dialogue_choice' THEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(public.learning_json_array(p_segment #> '{payload,turns}')) t
            WHERE jsonb_array_length(public.learning_json_array(t -> 'replies')) >= 2)
        WHEN 'would_you_rather' THEN true
        WHEN 'story.branch.v2' THEN true
        WHEN 'story.dialogue-choice.v2' THEN true
        WHEN 'story.would-you-rather.v2' THEN true
        ELSE false
    END IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.learning_story_decision_segment(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_story_decision_segment(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.learning_narrative_metrics(p_since timestamptz, p_until timestamptz)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    WITH v1_decisions AS (
        SELECT DISTINCT a.user_id, a.lesson_id, a.segment_id
        FROM public.lesson_segment_attempts a
        WHERE a.created_at >= p_since AND a.created_at < p_until
          AND EXISTS (
              SELECT 1
              FROM public.lesson_documents d
              CROSS JOIN LATERAL jsonb_array_elements(public.learning_json_array(d.document -> 'segments')) s
              WHERE d.lesson_id = a.lesson_id AND s ->> 'id' = a.segment_id
                AND public.learning_story_decision_segment(s))
    ),
    v2_decisions AS (
        SELECT DISTINCT r.user_id, run.lesson_id, r.segment_id
        FROM public.lesson_v2_grade_receipts r
        JOIN public.lesson_v2_runs run ON run.id = r.run_id
        JOIN public.lesson_document_versions v ON v.id = r.document_version_id
        WHERE r.created_at >= p_since AND r.created_at < p_until
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(public.learning_json_array(v.document -> 'segments')) s
              WHERE s ->> 'id' = r.segment_id AND public.learning_story_decision_segment(s))
    ),
    decisions AS (
        SELECT user_id, lesson_id, segment_id FROM v1_decisions
        UNION
        SELECT user_id, lesson_id, segment_id FROM v2_decisions
    ),
    classified AS (
        SELECT public.data_practice_applies(d.user_id, 'learning.decision_journal') AS applies,
               EXISTS (SELECT 1 FROM public.learner_decision_journal j
                       WHERE j.user_id = d.user_id AND j.lesson_id = d.lesson_id AND j.segment_id = d.segment_id) AS journaled
        FROM decisions d
    )
    SELECT jsonb_build_object(
        'journal_entries_recorded', (
            SELECT count(*) FROM public.learner_decision_journal j
            WHERE j.first_recorded_at >= p_since AND j.first_recorded_at < p_until),
        'journal_entries_resurfaced', (
            SELECT count(*) FROM public.learner_decision_journal j
            WHERE j.first_recorded_at >= p_since AND j.first_recorded_at < p_until
              AND EXISTS (SELECT 1 FROM public.learner_decision_resurfacings r WHERE r.entry_id = j.id)),
        'story_decisions_made', (SELECT count(*) FROM classified c WHERE c.applies),
        'story_decisions_journaled', (SELECT count(*) FROM classified c WHERE c.applies AND c.journaled),
        'story_decisions_without_consent', (SELECT count(*) FROM classified c WHERE NOT c.applies),
        'bridge_prompts_offered', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until),
        'bridge_prompts_converted_7d', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until AND p.status = 'acted'
              AND (p.result_task_id IS NOT NULL OR p.result_goal_id IS NOT NULL)
              AND p.closed_at <= p.created_at + interval '7 days'),
        'bridge_self_commitments', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until AND p.status = 'acted' AND p.audience = 'self'),
        'bridge_prompts_dismissed', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until AND p.status = 'dismissed'),
        'bridge_prompts_expired', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until
              AND (p.status = 'expired' OR (p.status = 'open' AND p.expires_at <= now())))
    );
$$;

REVOKE ALL ON FUNCTION public.learning_narrative_metrics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_narrative_metrics(timestamptz, timestamptz) TO service_role;
