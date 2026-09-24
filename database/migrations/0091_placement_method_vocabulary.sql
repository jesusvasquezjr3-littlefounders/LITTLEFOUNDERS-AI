-- @phase: contract
-- @after-release: none — pure widening; all historical method values remain valid.
-- Apply before shipping authored-probe placement; operator review is still required.
-- B.1: widen placement methods while retaining every historical value.
-- The conservative deployment classifier treats CHECK replacement as contract;
-- this migration therefore requires operator review rather than auto-apply.
-- ALTER TABLE holds its lock until the surrounding migration transaction ends.
ALTER TABLE public.course_placements
    DROP CONSTRAINT IF EXISTS course_placements_method_check,
    ADD CONSTRAINT course_placements_method_check CHECK (method IN (
        'quiz', 'claimed_beginner_shortcut', 'no_probe_content_fallback',
        'adaptive_quiz', 'learner_chose_start', 'learner_adjusted'
    ));
