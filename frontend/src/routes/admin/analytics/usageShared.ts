/*
 * The closed event vocabulary, mirrored from the database CHECK constraint.
 *
 * WHY A COPY RATHER THAN A FETCH
 *
 * The point of this list is to say which members have NEVER fired, and a list
 * derived from the data can only ever contain events that fired at least once.
 * An instrument that reports absence has to know what it expected to see; if
 * this came from the same query as the counts, `signup_complete` would simply
 * not appear and the card would look clean.
 *
 * The cost is that this drifts if the constraint changes. That is what
 * `usageShared.test.ts` is for: it reads `database/migrations/*.sql`, finds the
 * LAST `learning_events_event_check`, and fails if the two disagree — so
 * adding an event to the schema and forgetting this list is a red test, not a
 * silently short list.
 *
 * Source of truth: the final `learning_events_event_check` in
 * database/migrations (0028 at the time of writing; 0033 removed the game
 * vocabulary, which is why no `game_*` member appears here; 0072 added the
 * parent-report + shareable-achievement-badge loop's four events).
 */
export const INSTRUMENTED_EVENTS = [
  'session_start',
  'session_heartbeat',
  'session_end',
  'nav_view',
  'page_view',
  'cta_click',
  'scroll_depth',
  'signup_start',
  'signup_submit',
  'signup_complete',
  'login_complete',
  'course_open',
  'lesson_start',
  'lesson_complete',
  'first_lesson_complete',
  'lesson_abandon',
  'segment_view',
  'segment_submit',
  'segment_retry',
  'hint_open',
  'explanation_view',
  'audio_replay',
  'results_view',
  'task_view',
  'profile_edit',
  'avatar_edit',
  'tutor_open',
  'streak_extend',
  'territory_view',
  'consent_grant',
  'consent_revoke',
  'parent_report_viewed',
  'badge_generated',
  'badge_shared',
] as const;

/**
 * Values the database CHECK still permits but no client may emit any more.
 * `badge_link_click` measured a stranger opening a legacy badge link — viewer
 * reach, which OD-20's Appendix L never counts. Core refuses it; the CHECK is
 * narrowed in the dated removal (docs/rebuild/policies/ACHIEVEMENT-SHARING.md).
 */
export const RETIRED_EVENTS = ['badge_link_click'] as const;

export type InstrumentedEvent = (typeof INSTRUMENTED_EVENTS)[number];

export type UsageBand = 'anonymous' | 'registered' | 'staff';

/**
 * Mirrors `bandForRole` in backend/src/services/audience.ts.
 *
 * Duplicated deliberately rather than shared: the two packages have no common
 * module, and a band that disagreed across the wire would put a session in one
 * bucket on the server and another in the browser — which is the kind of
 * defect that shows up as a total that does not add up and takes a day to
 * find. `usageShared.test.ts` asserts the two definitions stay identical.
 */
export function bandOf(role: string): UsageBand {
  if (role === 'admin' || role === 'superadmin') return 'staff';
  if (role === 'anon') return 'anonymous';
  return 'registered';
}
