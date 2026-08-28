-- 0051_tutor_session_summary.sql
-- (Authored as 0050 on feat/tutor-v2; renumbered on rebase — a concurrent
-- session shipped 0050_audience_insights.sql to main first.)
--
-- Cross-session memory for the Tutor (/ORACLE.md §4.1, owner sign-off
-- 2026-08-28): each closed session gets a STRICT DIGEST — catalog topic,
-- skill keys, a closed outcome vocabulary, two bounded counters — computed by
-- Core at close time from rows it already holds. NEVER a transcript, never a
-- learner's words: the digest is what the next session's model context is
-- allowed to see (oracle/src/context/schema.ts PreviousSessionSchema), and
-- everything in it is data the model context already carried in some form.
--
-- A column on tutor_sessions rather than a table: the digest is 1:1 with a
-- session, dies with the session's row, and is therefore swept by the same
-- 90-day retention job with no new moving parts (backend tutorRetention.ts
-- deletes the row; the digest goes with it).
--
-- Shape (enforced in Core, documented here):
--   { "topic": text|null, "courseId": uuid|null, "topicId": uuid|null,
--     "skillKeys": text[], "outcome": "completed"|"left"|"stopped",
--     "gradedCorrect": int, "gradedTotal": int }

alter table public.tutor_sessions
  add column if not exists summary jsonb;

comment on column public.tutor_sessions.summary is
  'Strict digest written by Core at close for cross-session tutor memory — topic/skills/outcome/counters only, never transcript text (/ORACLE.md §4.1, 2026-08-28). Swept with the row at 90 days.';
