-- 0046_dataintel_staff_flag.sql — authoritative staff marker for the warehouse.
--
-- WHY THIS EXISTS
-- Measured against production on 2026-08-13: 3,502 of 3,869 first-party events
-- (90.5%) were stamped `superadmin`, produced by 2 accounts, and 24 of 24
-- lesson_segment_attempts belonged to staff. Every dataintel metric — DAU,
-- activation funnel, retention cohorts, churn scores, time-to-value, lesson
-- calibration — was therefore describing the platform team testing the product,
-- not its learners.
--
-- WHY A DEDICATED FLAG, AND NOT THE EXISTING `role` COLUMN
-- Neither role field already in play can answer "is this person staff?":
--   * `learning_events.role` is the event-time STAMP, and Core stamps the
--     highest-priority role in a fixed order (kid, parent, bigfounder,
--     superadmin, admin, universal — services/insights.ts). A superadmin who is
--     also a parent stamps as `parent`, so filtering the stamp alone leaks
--     staff activity into the parent cohort.
--   * `dataintel_users_sync.role` picks the MOST RECENTLY GRANTED role
--     (ORDER BY granted_at DESC LIMIT 1), so the same person reads as staff or
--     not depending on the order their grants happened to be written.
-- `is_staff` is an EXISTS over the whole role set: order-independent, and true
-- for anyone holding admin or superadmin regardless of what else they hold.
--
-- Idempotent (CREATE OR REPLACE VIEW). No table, no RLS surface of its own:
-- this only widens a service-role-only view that already exists (0026), and the
-- grants below are re-asserted because CREATE OR REPLACE resets them.

CREATE OR REPLACE VIEW dataintel_users_sync AS
SELECT
  u.id AS user_id,
  COALESCE(
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id ORDER BY ur.granted_at DESC LIMIT 1),
    'universal'
  ) AS role,
  u.created_at,
  COALESCE(up.locale, 'en-US') AS locale,
  COALESCE(ls.xp_points, 0) AS xp_points,
  COALESCE(ls.minutes_learned, 0) AS minutes_learned,
  COALESCE(ls.lessons_completed, 0) AS lessons_completed,
  COALESCE(ls.streak_days, 0) AS streak_days,
  COALESCE(ls.longest_streak, 0) AS longest_streak,
  -- Order-independent staff test. Do not "optimise" this into the
  -- single-role subquery above: that is what made staff undetectable.
  -- APPENDED, not inserted: CREATE OR REPLACE VIEW may only add columns at
  -- the END of the select list, so placing it beside `role` fails outright.
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = u.id AND ur.role IN ('admin', 'superadmin')
  ) AS is_staff
FROM auth.users u
LEFT JOIN profiles up ON up.user_id = u.id
LEFT JOIN learning_stats ls ON ls.user_id = u.id;

-- Same posture as 0026: service-role only, never reachable from a browser.
REVOKE ALL ON dataintel_users_sync FROM public, anon, authenticated;
GRANT SELECT ON dataintel_users_sync TO service_role;
