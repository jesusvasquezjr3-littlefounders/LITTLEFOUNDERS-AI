-- *_trajectory_stated_misconception_kind.sql — accept the
-- `stated_misconception` controller event in the Extended Mastery Engine
-- event log (Product C.10, Appendix F §1.1).
-- @phase: contract
-- @after-release: none — this WIDENS the event_kind CHECK (every value any Core
-- release has ever written stays valid); the conservative classifier treats any
-- dropped-and-re-added CHECK as a contraction, so this needs operator review
-- rather than auto-apply. Apply together with, or after, the matching Core
-- release that accepts `stated_misconception` in POST /tutor/internal/trajectory.
--
-- THE DEFECT THIS CLOSES. Oracle has always recorded a `stated_misconception`
-- step whenever the learner stated a wrong idea in plain words
-- (oracle/src/session/trajectory.ts), but 0066's CHECK and Core's request
-- validator both omitted it, so Core refused the WHOLE session's batch with a
-- 400 — every session containing one lost its entire trajectory. Those are
-- precisely the sessions C.10's remediation evidence is about: a stated idea
-- is one of the two observations that can corroborate a remediation. Core's
-- validator is widened in the same change; this widens the table.

ALTER TABLE public.tutor_trajectory_step
    DROP CONSTRAINT IF EXISTS tutor_trajectory_step_event_kind_check;

ALTER TABLE public.tutor_trajectory_step
    ADD CONSTRAINT tutor_trajectory_step_event_kind_check CHECK (event_kind IN (
        'activity_result', 'voice_result', 'conversation_turn', 'stated_misconception', 'entry_opened'
    ));
