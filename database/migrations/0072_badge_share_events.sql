-- 0072_badge_share_events.sql — widen learning_events for the parent report
-- surface and the shareable-achievement-badge viral loop.
-- @phase: contract
-- @after-release: 27c51a8b (this DROP/ADD CONSTRAINT is a pure widen — no
--   value is removed — but check-migration-phase.mjs classifies every
--   dropped-and-re-added CHECK as a contraction regardless of direction,
--   deliberately, since the gate cannot parse old-vs-new value sets
--   semantically. Nothing here depends on an older deploy retiring a
--   removed value, so the named release is simply the current HEAD at
--   authoring time: this migration must still land (manual `tutor-deploy.yml`
--   step: migrate path) BEFORE any code emits the four new event values,
--   exactly like a normal expand — the gate's mechanical caution costs one
--   manual dispatch, which is cheaper than the outage an under-called
--   contraction risks (database/AGENTS.md).
--
-- Four new closed-vocabulary values, following the DROP/ADD CONSTRAINT
-- pattern 0033 established for this same CHECK:
--   parent_report_viewed — a verified guardian opened their kid's report/
--     stats view. route_class 'family'.
--   badge_generated       — a shareable achievement image was composited
--     for a kid (badge_shares insert, see 0073). route_class 'family'.
--   badge_shared           — the parent completed a share action
--     (navigator.share confirmed, or a copy-link fallback). route_class
--     'family'.
--   badge_link_click       — someone opened the public badge landing page
--     from a shared link. route_class 'marketing' — this is the ONE event
--     of the four an ANONYMOUS visitor may report (Core's events route
--     ANON_EVENTS set), because the whole point of the loop is a click from
--     someone who is not yet, and may never become, an account. The
--     resulting signup ("registros" in the loop) needs no new event: it is
--     the existing signup_complete → attributeSignup path, attributed via
--     the visitor's stored utm_campaign (INSIGHTS.md, /AGENTS.md §1.15's
--     "never a number without a source" applies equally to this funnel —
--     badge-driven signups are counted through the SAME attribution path
--     as every other campaign, not a parallel one).
--
-- route_class_check is unchanged: 'family' and 'marketing' are both already
-- members (0033).
ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_event_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_event_check CHECK (event IN (
    'session_start', 'session_heartbeat', 'session_end', 'nav_view',
    'page_view', 'cta_click', 'scroll_depth',
    'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
    'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
    'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
    'hint_open', 'explanation_view', 'audio_replay', 'results_view',
    'task_view', 'profile_edit', 'avatar_edit', 'tutor_open',
    'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke',
    'parent_report_viewed', 'badge_generated', 'badge_shared', 'badge_link_click'
  ));
