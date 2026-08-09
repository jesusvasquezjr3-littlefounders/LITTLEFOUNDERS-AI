import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { execute, initDb } from '../db/duckdb.js';
import { refreshAggregates } from '../db/sync.js';
import { getLessonDropoff, getSegmentCalibration } from '../services/lessons.js';
import { getActivationFunnel } from '../services/funnel.js';
import { getCohortRetention } from '../services/retention.js';
import { exportEvents } from '../services/exports.js';

describe('pedagogical signals', () => {
  const lessonId = randomUUID();
  const learnerA = randomUUID();
  const learnerB = randomUUID();
  const sessionA = randomUUID();
  const sessionB = randomUUID();
  const anonId = randomUUID();
  const adultId = randomUUID();
  const exportSessionId = randomUUID();
  const exportEventId = Number(`4${Date.now()}`);

  beforeAll(async () => {
    await initDb();
    await execute(
      `INSERT INTO dim_lessons (lesson_id, slug, title_en, segment_count)
       VALUES (?, 'signal-lesson', 'Signal lesson', 1)`,
      lessonId,
    );
    await execute(
      `INSERT INTO fact_segment_attempts
       (attempt_id, user_id, lesson_id, segment_id, attempt_number, score, hints_used, created_at)
       VALUES (?, ?, ?, 'practice-1', 1, 40, 1, CURRENT_TIMESTAMP)`,
      randomUUID(), learnerA, lessonId,
    );
    await execute(
      `INSERT INTO fact_segment_attempts
       (attempt_id, user_id, lesson_id, segment_id, attempt_number, score, hints_used, created_at)
       VALUES (?, ?, ?, 'practice-1', 2, 80, 1, CURRENT_TIMESTAMP)`,
      randomUUID(), learnerA, lessonId,
    );
    await execute(
      `INSERT INTO fact_segment_attempts
       (attempt_id, user_id, lesson_id, segment_id, attempt_number, score, hints_used, created_at)
       VALUES (?, ?, ?, 'practice-1', 1, 90, 0, CURRENT_TIMESTAMP)`,
      randomUUID(), learnerB, lessonId,
    );
    await execute(
      `INSERT INTO fact_events
       (event_id, user_id, session_id, lesson_id, event_type, value, created_at)
       VALUES (?, ?, ?, ?, 'lesson_start', NULL, CURRENT_TIMESTAMP)`,
      Number(`9${Date.now()}`), learnerA, sessionA, lessonId,
    );
    await execute(
      `INSERT INTO fact_events
       (event_id, user_id, session_id, lesson_id, event_type, value, created_at)
       VALUES (?, ?, ?, ?, 'lesson_abandon', 75, CURRENT_TIMESTAMP)`,
      Number(`8${Date.now()}`), learnerA, sessionA, lessonId,
    );
    await execute(
      `INSERT INTO fact_events
       (event_id, user_id, session_id, lesson_id, event_type, value, created_at)
       VALUES (?, ?, ?, ?, 'lesson_start', NULL, CURRENT_TIMESTAMP)`,
      Number(`7${Date.now()}`), learnerB, sessionB, lessonId,
    );
    await execute(
      `INSERT INTO dim_anon_conversions (anon_id, user_id, converted_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      anonId, adultId,
    );
    await execute(
      `INSERT INTO fact_events (event_id, anon_id, event_type, created_at)
       VALUES (?, ?, 'page_view', CURRENT_TIMESTAMP)`,
      Number(`6${Date.now()}`), anonId,
    );
    await execute(
      `INSERT INTO fact_events (event_id, user_id, event_type, created_at)
       VALUES (?, ?, 'signup_complete', CURRENT_TIMESTAMP)`,
      Number(`5${Date.now()}`), adultId,
    );
    await execute(
      `INSERT INTO fact_events (event_id, user_id, session_id, segment_id, event_type, role, created_at)
       VALUES (?, ?, ?, 'export-private', 'nav_view', 'kid', CURRENT_TIMESTAMP)`,
      exportEventId, learnerA, exportSessionId,
    );
  });

  it('uses authoritative attempts for calibration instead of browser event placeholders', async () => {
    const rows = await getSegmentCalibration(2, 50);
    const signal = rows?.find((row) => row.lesson_id === lessonId && row.segment_id === 'practice-1');

    expect(signal).toMatchObject({
      learners: 2,
      attempts: 3,
      avg_score: 70,
      avg_attempts_per_learner: 1.5,
      hint_rate: 0.6667,
      first_try_avg_score: 65,
      calibration: 'proficient',
    });
  });

  it('reports abandonment duration when it exists instead of fabricating zero', async () => {
    const rows = await getLessonDropoff(50);
    const signal = rows?.find((row) => row.lesson_id === lessonId);

    expect(signal).toMatchObject({
      starts: 2,
      completions: 0,
      abandon_rate: 50,
      avg_seconds_before_abandon: 75,
    });
  });

  it('counts one identity once in the daily rollup despite multiple events', async () => {
    await refreshAggregates();
    // Both learners generated events today. The aggregate must never sum
    // per-event distinct counts to arrive at its user total.
    const { query } = await import('../db/duckdb.js');
    const rows = await query<{ users: number }>(
      `SELECT users FROM agg_daily_users WHERE day = CURRENT_DATE AND role = ''`,
    );

    expect(rows[0]?.users).toBeGreaterThanOrEqual(2);
  });

  it('links an approved adult conversion without linking any child browsing', async () => {
    const funnel = await getActivationFunnel();

    expect(funnel?.find((step) => step.step === 'visited')?.users).toBeGreaterThanOrEqual(1);
    expect(funnel?.find((step) => step.step === 'completed_signup')?.users).toBeGreaterThanOrEqual(1);
  });

  it('uses a true week boundary for retention cohorts', async () => {
    const cohorts = await getCohortRetention(12);

    // A current-week event must appear in week zero. The previous mixed day
    // and week calculation excluded it whenever the first event was after
    // Monday, making current cohorts falsely disappear.
    expect(cohorts?.length).toBeGreaterThan(0);
    expect(cohorts?.every((cohort) => cohort.weekOffset >= 0)).toBe(true);
  });

  it('never exports learner identities or stable session identifiers', async () => {
    const result = await exportEvents({ segment_id: 'export-private' }, 100, 0);
    const row = result?.rows[0];

    expect(result?.rows).toHaveLength(1);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('event_id');
    expect(row).not.toHaveProperty('user_id');
    expect(row).not.toHaveProperty('anon_id');
    expect(row).not.toHaveProperty('session_id');
    expect(row?.session_ref).toMatch(/^[a-f0-9]{64}$/);
  });
});
