import { exec, query } from '../db/duckdb.js';

export type RecommendedAction = 'remediate' | 'practice' | 'retrieve' | 'continue';

export interface LearnerSkillState {
  skillKey: string;
  courseId: string | null;
  topicId: string | null;
  masteryProbability: number;
  uncertainty: number;
  evidenceCount: number;
  firstPracticedAt: string | null;
  lastPracticedAt: string | null;
  reviewDueAt: string | null;
  recommendedAction: RecommendedAction;
  reasonCode: string;
}

export interface SkillHealth {
  skillKey: string;
  courseId: string | null;
  topicId: string | null;
  learners: number;
  attempts: number;
  avgMasteryProbability: number;
  lowMasteryPct: number;
  avgSecondsPerAttempt: number | null;
  hintRate: number;
  priority: 'review' | 'monitor' | 'insufficient_evidence';
}

export type EvidenceStatus = 'awaiting_evidence' | 'limited' | 'sufficient';
export type AttentionStatus = 'awaiting_evidence' | 'monitor' | 'review' | 'healthy';

export interface LearningSnapshot {
  courses: number;
  lessons: number;
  attempts: number;
  learners: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
  hintRate: number | null;
  retryRate: number | null;
  avgSecondsPerAttempt: number | null;
  evidenceStatus: EvidenceStatus;
}

export interface LearningTrendPoint {
  date: string;
  attempts: number;
  learners: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
}

export interface CourseHealth {
  courseId: string;
  courseSlug: string | null;
  courseTitleEn: string | null;
  courseTitleEs: string | null;
  courseTitlePt: string | null;
  lessons: number;
  segments: number;
  learners: number;
  attempts: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
  hintRate: number | null;
  retryRate: number | null;
  avgSecondsPerAttempt: number | null;
  starts: number;
  completions: number;
  abandons: number;
  abandonRate: number | null;
  evidenceStatus: EvidenceStatus;
  attention: AttentionStatus;
}

export interface LessonHealth extends CourseHealth {
  lessonId: string;
  lessonSlug: string | null;
  lessonTitleEn: string | null;
  lessonTitleEs: string | null;
  lessonTitlePt: string | null;
  segments: number;
}

export interface LearnerProfile {
  userId: string;
  role: string | null;
  coursesTouched: number;
  lessonsTouched: number;
  attempts: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
  hintRate: number | null;
  retryRate: number | null;
  avgMasteryProbability: number | null;
  skillsNeedingSupport: number;
  recommendedAction: RecommendedAction | null;
  lastActiveAt: string | null;
  evidenceStatus: EvidenceStatus;
}

export interface LearnerLearningDetail {
  profile: LearnerProfile | null;
  trends: LearningTrendPoint[];
  courses: CourseHealth[];
  lessons: LessonHealth[];
  states: LearnerSkillState[];
}

export interface LearningOverview {
  snapshot: LearningSnapshot;
  trends: LearningTrendPoint[];
  courses: CourseHealth[];
  lessons: LessonHealth[];
  learners: LearnerProfile[];
}

interface LearnerSkillStateRow {
  skill_key: string;
  course_id: string | null;
  topic_id: string | null;
  mastery_probability: number;
  uncertainty: number;
  evidence_count: number;
  first_practiced_at: string | Date | null;
  last_practiced_at: string | Date | null;
  review_due_at: string | Date | null;
  recommended_action: RecommendedAction;
  reason_code: string;
}

const dateOrNull = (value: string | Date | null): string | null =>
  value === null ? null : new Date(value).toISOString();

function toState(row: LearnerSkillStateRow): LearnerSkillState {
  return {
    skillKey: row.skill_key,
    courseId: row.course_id,
    topicId: row.topic_id,
    masteryProbability: Number(row.mastery_probability),
    uncertainty: Number(row.uncertainty),
    evidenceCount: Number(row.evidence_count),
    firstPracticedAt: dateOrNull(row.first_practiced_at),
    lastPracticedAt: dateOrNull(row.last_practiced_at),
    reviewDueAt: dateOrNull(row.review_due_at),
    recommendedAction: row.recommended_action,
    reasonCode: row.reason_code,
  };
}

/**
 * Refreshes an interpretable beta-posterior skill state from authoritative
 * grades. The prior (2 successes, 2 failures) prevents a single lucky or
 * unlucky answer from being labelled mastery. Scores are fractional evidence,
 * not opaque model output, so staff can explain every recommendation.
 */
export async function refreshLearnerSkillStates(): Promise<void> {
  await exec('DELETE FROM learner_skill_states');
  await exec(`
    INSERT INTO learner_skill_states (
      user_id, skill_key, course_id, topic_id, mastery_probability, uncertainty,
      evidence_count, first_practiced_at, last_practiced_at, review_due_at,
      recommended_action, reason_code, updated_at
    )
    WITH evidence AS (
      SELECT
        user_id,
        skill_key,
        arg_max(course_id, created_at) AS course_id,
        arg_max(topic_id, created_at) AS topic_id,
        COUNT(*)::INTEGER AS evidence_count,
        SUM(score / 100.0) AS weighted_successes,
        MIN(created_at) AS first_practiced_at,
        MAX(created_at) AS last_practiced_at
      FROM fact_segment_attempts
      WHERE skill_key IS NOT NULL
      GROUP BY user_id, skill_key
    ), posterior AS (
      SELECT
        *,
        (2.0 + weighted_successes) / (4.0 + evidence_count) AS mastery_probability,
        SQRT(
          ((2.0 + weighted_successes) / (4.0 + evidence_count))
          * (1.0 - ((2.0 + weighted_successes) / (4.0 + evidence_count)))
          / (5.0 + evidence_count)
        ) AS uncertainty
      FROM evidence
    ), scheduled AS (
      SELECT
        *,
        last_practiced_at + CASE
          WHEN mastery_probability < 0.55 THEN INTERVAL 1 DAY
          WHEN mastery_probability < 0.80 THEN INTERVAL 3 DAY
          ELSE INTERVAL 7 DAY
        END AS review_due_at
      FROM posterior
    )
    SELECT
      user_id,
      skill_key,
      course_id,
      topic_id,
      ROUND(mastery_probability, 6),
      ROUND(uncertainty, 6),
      evidence_count,
      first_practiced_at,
      last_practiced_at,
      review_due_at,
      CASE
        WHEN mastery_probability < 0.55 THEN 'remediate'
        WHEN mastery_probability < 0.80 THEN 'practice'
        WHEN review_due_at <= CURRENT_TIMESTAMP THEN 'retrieve'
        ELSE 'continue'
      END AS recommended_action,
      CASE
        WHEN evidence_count < 3 THEN 'low_evidence'
        WHEN mastery_probability < 0.55 THEN 'low_mastery'
        WHEN mastery_probability < 0.80 THEN 'developing_mastery'
        WHEN review_due_at <= CURRENT_TIMESTAMP THEN 'review_due'
        ELSE 'stable_mastery'
      END AS reason_code,
      CURRENT_TIMESTAMP
    FROM scheduled
  `);
}

export async function getLearnerSkillStates(userId: string): Promise<LearnerSkillState[] | null> {
  try {
    const rows = await query<LearnerSkillStateRow>(
      `SELECT *
       FROM learner_skill_states
       WHERE user_id = $1
       ORDER BY CASE recommended_action
         WHEN 'remediate' THEN 1
         WHEN 'practice' THEN 2
         WHEN 'retrieve' THEN 3
         ELSE 4
       END, uncertainty DESC, last_practiced_at ASC`,
      userId,
    );
    return rows.map(toState);
  } catch (err) {
    console.error('[dataintel][learning] getLearnerSkillStates failed:', err);
    return null;
  }
}

export async function getLearnerRecommendation(userId: string): Promise<LearnerSkillState | null | undefined> {
  const states = await getLearnerSkillStates(userId);
  if (states === null) return null;
  return states[0];
}

/**
 * Content-facing aggregate: enough evidence to prioritize review without
 * exposing individual learners. A low score alone is not a content defect;
 * it becomes actionable only after enough independent learner states agree.
 */
export async function getSkillHealth(limit: number): Promise<SkillHealth[] | null> {
  try {
    const rows = await query<{
      skill_key: string;
      course_id: string | null;
      topic_id: string | null;
      learners: number;
      attempts: number;
      avg_mastery_probability: number;
      low_mastery_pct: number;
      avg_seconds_per_attempt: number | null;
      hint_rate: number;
    }>(`
      WITH evidence AS (
        SELECT
          skill_key,
          COUNT(*) AS attempts,
          AVG(time_spent_seconds) AS avg_seconds_per_attempt,
          AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate
        FROM fact_segment_attempts
        WHERE skill_key IS NOT NULL
        GROUP BY skill_key
      )
      SELECT
        states.skill_key,
        arg_max(states.course_id, states.updated_at) AS course_id,
        arg_max(states.topic_id, states.updated_at) AS topic_id,
        COUNT(*) AS learners,
        COALESCE(evidence.attempts, 0) AS attempts,
        AVG(states.mastery_probability) AS avg_mastery_probability,
        AVG(CASE WHEN states.mastery_probability < 0.55 THEN 1.0 ELSE 0.0 END) * 100 AS low_mastery_pct,
        evidence.avg_seconds_per_attempt,
        COALESCE(evidence.hint_rate, 0) AS hint_rate
      FROM learner_skill_states states
      LEFT JOIN evidence USING (skill_key)
      GROUP BY states.skill_key, evidence.attempts, evidence.avg_seconds_per_attempt, evidence.hint_rate
      ORDER BY
        CASE WHEN COUNT(*) >= 5 AND AVG(states.mastery_probability) < 0.55 THEN 0 ELSE 1 END,
        AVG(states.mastery_probability) ASC,
        COUNT(*) DESC
      LIMIT $1
    `, limit);
    return rows.map((row) => {
      const learners = Number(row.learners);
      const average = Number(row.avg_mastery_probability);
      return {
        skillKey: row.skill_key,
        courseId: row.course_id,
        topicId: row.topic_id,
        learners,
        attempts: Number(row.attempts),
        avgMasteryProbability: average,
        lowMasteryPct: Number(row.low_mastery_pct),
        avgSecondsPerAttempt: row.avg_seconds_per_attempt === null ? null : Number(row.avg_seconds_per_attempt),
        hintRate: Number(row.hint_rate),
        priority: learners < 5
          ? 'insufficient_evidence'
          : average < 0.55
            ? 'review'
            : 'monitor',
      };
    });
  } catch (err) {
    console.error('[dataintel][learning] getSkillHealth failed:', err);
    return null;
  }
}

const numberOrNull = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

const isoOrNull = (value: string | Date | null | undefined): string | null =>
  value === null || value === undefined ? null : new Date(value).toISOString();

function evidenceStatus(attempts: number, learners: number): EvidenceStatus {
  if (attempts === 0 || learners === 0) return 'awaiting_evidence';
  if (attempts < 20 || learners < 5) return 'limited';
  return 'sufficient';
}

function attentionStatus(
  evidence: EvidenceStatus,
  avgScore: number | null,
  firstTryAvgScore: number | null,
  hintRate: number | null,
  abandonRate: number | null,
): AttentionStatus {
  if (evidence === 'awaiting_evidence') return 'awaiting_evidence';
  if (evidence === 'limited') return 'monitor';
  if (
    (firstTryAvgScore !== null && firstTryAvgScore < 55)
    || (avgScore !== null && avgScore < 60)
    || (abandonRate !== null && abandonRate >= 35)
  ) return 'review';
  if (
    (firstTryAvgScore !== null && firstTryAvgScore < 75)
    || (hintRate !== null && hintRate >= 0.35)
    || (abandonRate !== null && abandonRate >= 20)
  ) return 'monitor';
  return 'healthy';
}

interface CatalogHealthRow {
  course_id: string;
  course_slug: string | null;
  course_title_en: string | null;
  course_title_es: string | null;
  course_title_pt: string | null;
  lesson_id?: string;
  lesson_slug?: string | null;
  lesson_title_en?: string | null;
  lesson_title_es?: string | null;
  lesson_title_pt?: string | null;
  lessons: number;
  segments: number;
  learners: number;
  attempts: number;
  avg_score: number | null;
  first_try_avg_score: number | null;
  hint_rate: number | null;
  retry_rate: number | null;
  avg_seconds_per_attempt: number | null;
  starts: number;
  completions: number;
  abandons: number;
  abandon_rate: number | null;
}

function toCourseHealth(row: CatalogHealthRow): CourseHealth {
  const attempts = Number(row.attempts);
  const learners = Number(row.learners);
  const avgScore = numberOrNull(row.avg_score);
  const firstTryAvgScore = numberOrNull(row.first_try_avg_score);
  const hintRate = numberOrNull(row.hint_rate);
  const abandonRate = numberOrNull(row.abandon_rate);
  const evidence = evidenceStatus(attempts, learners);
  return {
    courseId: row.course_id,
    courseSlug: row.course_slug,
    courseTitleEn: row.course_title_en,
    courseTitleEs: row.course_title_es,
    courseTitlePt: row.course_title_pt,
    lessons: Number(row.lessons),
    segments: Number(row.segments),
    learners,
    attempts,
    avgScore,
    firstTryAvgScore,
    hintRate,
    retryRate: numberOrNull(row.retry_rate),
    avgSecondsPerAttempt: numberOrNull(row.avg_seconds_per_attempt),
    starts: Number(row.starts),
    completions: Number(row.completions),
    abandons: Number(row.abandons),
    abandonRate,
    evidenceStatus: evidence,
    attention: attentionStatus(evidence, avgScore, firstTryAvgScore, hintRate, abandonRate),
  };
}

function toLessonHealth(row: CatalogHealthRow): LessonHealth {
  const course = toCourseHealth(row);
  return {
    ...course,
    lessonId: row.lesson_id ?? '',
    lessonSlug: row.lesson_slug ?? null,
    lessonTitleEn: row.lesson_title_en ?? null,
    lessonTitleEs: row.lesson_title_es ?? null,
    lessonTitlePt: row.lesson_title_pt ?? null,
  };
}

const courseCatalogSql = `
  WITH course_catalog AS (
    SELECT
      course_id,
      MAX(course_slug) AS course_slug,
      MAX(course_title_en) AS course_title_en,
      MAX(course_title_es) AS course_title_es,
      MAX(course_title_pt) AS course_title_pt,
      COUNT(*) AS lessons,
      SUM(segment_count) AS segments
    FROM dim_lessons
    WHERE course_id IS NOT NULL
    GROUP BY course_id
  ), attempts AS (
    SELECT
      course_id,
      COUNT(*) AS attempts,
      COUNT(DISTINCT user_id) AS learners,
      AVG(score) AS avg_score,
      AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score,
      AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate,
      AVG(CASE WHEN attempt_number > 1 THEN 1.0 ELSE 0.0 END) AS retry_rate,
      AVG(time_spent_seconds) AS avg_seconds_per_attempt
    FROM fact_segment_attempts
    WHERE created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
      AND course_id IS NOT NULL
    GROUP BY course_id
  ), events AS (
    SELECT
      COALESCE(fe.course_id, dl.course_id) AS course_id,
      COUNT(*) FILTER (WHERE fe.event_type = 'lesson_start') AS starts,
      COUNT(*) FILTER (WHERE fe.event_type = 'lesson_complete') AS completions,
      COUNT(*) FILTER (WHERE fe.event_type = 'lesson_abandon') AS abandons
    FROM fact_events fe
    LEFT JOIN dim_lessons dl ON dl.lesson_id = fe.lesson_id
    WHERE fe.created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
      AND fe.event_type IN ('lesson_start', 'lesson_complete', 'lesson_abandon')
    GROUP BY COALESCE(fe.course_id, dl.course_id)
  )
  SELECT
    cc.*,
    COALESCE(a.learners, 0) AS learners,
    COALESCE(a.attempts, 0) AS attempts,
    a.avg_score,
    a.first_try_avg_score,
    a.hint_rate,
    a.retry_rate,
    a.avg_seconds_per_attempt,
    COALESCE(e.starts, 0) AS starts,
    COALESCE(e.completions, 0) AS completions,
    COALESCE(e.abandons, 0) AS abandons,
    CASE WHEN COALESCE(e.starts, 0) > 0
      THEN ROUND(e.abandons * 100.0 / e.starts, 2)
      ELSE NULL
    END AS abandon_rate
  FROM course_catalog cc
  LEFT JOIN attempts a USING (course_id)
  LEFT JOIN events e USING (course_id)
`;

const lessonCatalogSql = `
  WITH attempts AS (
    SELECT
      lesson_id,
      COUNT(*) AS attempts,
      COUNT(DISTINCT user_id) AS learners,
      AVG(score) AS avg_score,
      AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score,
      AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate,
      AVG(CASE WHEN attempt_number > 1 THEN 1.0 ELSE 0.0 END) AS retry_rate,
      AVG(time_spent_seconds) AS avg_seconds_per_attempt
    FROM fact_segment_attempts
    WHERE created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
    GROUP BY lesson_id
  ), events AS (
    SELECT
      lesson_id,
      COUNT(*) FILTER (WHERE event_type = 'lesson_start') AS starts,
      COUNT(*) FILTER (WHERE event_type = 'lesson_complete') AS completions,
      COUNT(*) FILTER (WHERE event_type = 'lesson_abandon') AS abandons
    FROM fact_events
    WHERE created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
      AND lesson_id IS NOT NULL
      AND event_type IN ('lesson_start', 'lesson_complete', 'lesson_abandon')
    GROUP BY lesson_id
  )
  SELECT
    dl.course_id,
    dl.course_slug,
    dl.course_title_en,
    dl.course_title_es,
    dl.course_title_pt,
    dl.lesson_id,
    dl.slug AS lesson_slug,
    dl.title_en AS lesson_title_en,
    dl.title_es AS lesson_title_es,
    dl.title_pt AS lesson_title_pt,
    1 AS lessons,
    dl.segment_count AS segments,
    COALESCE(a.learners, 0) AS learners,
    COALESCE(a.attempts, 0) AS attempts,
    a.avg_score,
    a.first_try_avg_score,
    a.hint_rate,
    a.retry_rate,
    a.avg_seconds_per_attempt,
    COALESCE(e.starts, 0) AS starts,
    COALESCE(e.completions, 0) AS completions,
    COALESCE(e.abandons, 0) AS abandons,
    CASE WHEN COALESCE(e.starts, 0) > 0
      THEN ROUND(e.abandons * 100.0 / e.starts, 2)
      ELSE NULL
    END AS abandon_rate
  FROM dim_lessons dl
  LEFT JOIN attempts a USING (lesson_id)
  LEFT JOIN events e USING (lesson_id)
`;

export async function getLearningOverview(days: number, limit: number): Promise<LearningOverview | null> {
  try {
    const [snapshotRows, trendRows, courseRows, lessonRows, learnerRows] = await Promise.all([
      query<{
        courses: number; lessons: number; attempts: number; learners: number;
        avg_score: number | null; first_try_avg_score: number | null; hint_rate: number | null;
        retry_rate: number | null; avg_seconds_per_attempt: number | null;
      }>(`
        WITH catalog AS (SELECT COUNT(DISTINCT course_id) AS courses, COUNT(*) AS lessons FROM dim_lessons),
        evidence AS (
          SELECT COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners,
            AVG(score) AS avg_score, AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score,
            AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate,
            AVG(CASE WHEN attempt_number > 1 THEN 1.0 ELSE 0.0 END) AS retry_rate,
            AVG(time_spent_seconds) AS avg_seconds_per_attempt
          FROM fact_segment_attempts
          WHERE created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
        )
        SELECT catalog.*, evidence.* FROM catalog CROSS JOIN evidence
      `, days),
      query<{ date: string | Date; attempts: number; learners: number; avg_score: number | null; first_try_avg_score: number | null }>(`
        SELECT created_at::DATE AS date, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners,
          AVG(score) AS avg_score, AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score
        FROM fact_segment_attempts
        WHERE created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
        GROUP BY created_at::DATE
        ORDER BY date
      `, days),
      query<CatalogHealthRow>(`${courseCatalogSql} ORDER BY attempts DESC, learners DESC, course_title_en ASC NULLS LAST LIMIT $2`, days, limit),
      query<CatalogHealthRow>(`${lessonCatalogSql} ORDER BY attempts DESC, learners DESC, lesson_title_en ASC NULLS LAST LIMIT $2`, days, limit),
      getLearnerProfiles(days, limit),
    ]);
    const row = snapshotRows[0];
    if (!row) return null;
    const attempts = Number(row.attempts);
    const learners = Number(row.learners);
    return {
      snapshot: {
        courses: Number(row.courses),
        lessons: Number(row.lessons),
        attempts,
        learners,
        avgScore: numberOrNull(row.avg_score),
        firstTryAvgScore: numberOrNull(row.first_try_avg_score),
        hintRate: numberOrNull(row.hint_rate),
        retryRate: numberOrNull(row.retry_rate),
        avgSecondsPerAttempt: numberOrNull(row.avg_seconds_per_attempt),
        evidenceStatus: evidenceStatus(attempts, learners),
      },
      trends: trendRows.map((entry) => ({
        date: new Date(entry.date).toISOString().slice(0, 10),
        attempts: Number(entry.attempts),
        learners: Number(entry.learners),
        avgScore: numberOrNull(entry.avg_score),
        firstTryAvgScore: numberOrNull(entry.first_try_avg_score),
      })),
      courses: courseRows.map(toCourseHealth),
      lessons: lessonRows.map(toLessonHealth),
      learners: learnerRows ?? [],
    };
  } catch (err) {
    console.error('[dataintel][learning] getLearningOverview failed:', err);
    return null;
  }
}

export async function getLearnerProfiles(days: number, limit: number): Promise<LearnerProfile[] | null> {
  try {
    const rows = await query<{
      user_id: string; role: string | null; courses_touched: number; lessons_touched: number; attempts: number;
      avg_score: number | null; first_try_avg_score: number | null; hint_rate: number | null; retry_rate: number | null;
      avg_mastery_probability: number | null; skills_needing_support: number; recommended_action: RecommendedAction | null;
      last_active_at: string | Date | null;
    }>(`
      WITH attempts AS (
        SELECT user_id, COUNT(*) AS attempts, COUNT(DISTINCT course_id) AS courses_touched,
          COUNT(DISTINCT lesson_id) AS lessons_touched, AVG(score) AS avg_score,
          AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score,
          AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate,
          AVG(CASE WHEN attempt_number > 1 THEN 1.0 ELSE 0.0 END) AS retry_rate,
          MAX(created_at) AS last_attempt_at
        FROM fact_segment_attempts
        WHERE created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
        GROUP BY user_id
      ), events AS (
        SELECT user_id, MAX(created_at) AS last_event_at
        FROM fact_events
        WHERE user_id IS NOT NULL AND created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL 1 DAY)
        GROUP BY user_id
      ), states AS (
        SELECT user_id, AVG(mastery_probability) AS avg_mastery_probability,
          COUNT(*) FILTER (WHERE recommended_action IN ('remediate', 'practice')) AS skills_needing_support,
          CASE
            WHEN COUNT(*) FILTER (WHERE recommended_action = 'remediate') > 0 THEN 'remediate'
            WHEN COUNT(*) FILTER (WHERE recommended_action = 'practice') > 0 THEN 'practice'
            WHEN COUNT(*) FILTER (WHERE recommended_action = 'retrieve') > 0 THEN 'retrieve'
            WHEN COUNT(*) > 0 THEN 'continue'
            ELSE NULL
          END AS recommended_action
        FROM learner_skill_states
        GROUP BY user_id
      ), candidates AS (
        SELECT user_id FROM attempts UNION SELECT user_id FROM events UNION SELECT user_id FROM states
      )
      SELECT c.user_id, du.role,
        COALESCE(a.courses_touched, 0) AS courses_touched, COALESCE(a.lessons_touched, 0) AS lessons_touched,
        COALESCE(a.attempts, 0) AS attempts, a.avg_score, a.first_try_avg_score, a.hint_rate, a.retry_rate,
        s.avg_mastery_probability, COALESCE(s.skills_needing_support, 0) AS skills_needing_support,
        s.recommended_action, GREATEST(a.last_attempt_at, e.last_event_at) AS last_active_at
      FROM candidates c
      LEFT JOIN dim_users du USING (user_id)
      LEFT JOIN attempts a USING (user_id)
      LEFT JOIN events e USING (user_id)
      LEFT JOIN states s USING (user_id)
      ORDER BY skills_needing_support DESC, avg_mastery_probability ASC NULLS LAST, attempts DESC
      LIMIT $2
    `, days, limit);
    return rows.map((row) => {
      const attempts = Number(row.attempts);
      const learners = attempts > 0 ? 1 : 0;
      return {
        userId: row.user_id,
        role: row.role,
        coursesTouched: Number(row.courses_touched),
        lessonsTouched: Number(row.lessons_touched),
        attempts,
        avgScore: numberOrNull(row.avg_score),
        firstTryAvgScore: numberOrNull(row.first_try_avg_score),
        hintRate: numberOrNull(row.hint_rate),
        retryRate: numberOrNull(row.retry_rate),
        avgMasteryProbability: numberOrNull(row.avg_mastery_probability),
        skillsNeedingSupport: Number(row.skills_needing_support),
        recommendedAction: row.recommended_action,
        lastActiveAt: isoOrNull(row.last_active_at),
        evidenceStatus: evidenceStatus(attempts, learners),
      };
    });
  } catch (err) {
    console.error('[dataintel][learning] getLearnerProfiles failed:', err);
    return null;
  }
}

export async function getLearnerLearningDetail(userId: string, days: number, limit: number): Promise<LearnerLearningDetail | null> {
  try {
    const [profiles, trends, courseRows, lessonRows, states] = await Promise.all([
      getLearnerProfiles(days, 1000),
      query<{ date: string | Date; attempts: number; learners: number; avg_score: number | null; first_try_avg_score: number | null }>(`
        SELECT created_at::DATE AS date, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners,
          AVG(score) AS avg_score, AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score
        FROM fact_segment_attempts
        WHERE user_id = $1 AND created_at >= CURRENT_TIMESTAMP - ($2 * INTERVAL 1 DAY)
        GROUP BY created_at::DATE ORDER BY date
      `, userId, days),
      query<CatalogHealthRow>(`
        WITH attempts AS (
          SELECT course_id, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners, AVG(score) AS avg_score,
            AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score,
            AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate,
            AVG(CASE WHEN attempt_number > 1 THEN 1.0 ELSE 0.0 END) AS retry_rate,
            AVG(time_spent_seconds) AS avg_seconds_per_attempt
          FROM fact_segment_attempts WHERE user_id = $1 AND created_at >= CURRENT_TIMESTAMP - ($2 * INTERVAL 1 DAY) GROUP BY course_id
        )
        SELECT a.course_id, MAX(dl.course_slug) AS course_slug, MAX(dl.course_title_en) AS course_title_en,
          MAX(dl.course_title_es) AS course_title_es, MAX(dl.course_title_pt) AS course_title_pt,
          COUNT(DISTINCT dl.lesson_id) AS lessons, COALESCE(SUM(dl.segment_count), 0) AS segments,
          a.learners, a.attempts, a.avg_score, a.first_try_avg_score, a.hint_rate, a.retry_rate, a.avg_seconds_per_attempt,
          0 AS starts, 0 AS completions, 0 AS abandons, NULL AS abandon_rate
        FROM attempts a LEFT JOIN dim_lessons dl ON dl.course_id = a.course_id
        GROUP BY a.course_id, a.learners, a.attempts, a.avg_score, a.first_try_avg_score, a.hint_rate, a.retry_rate, a.avg_seconds_per_attempt
        ORDER BY a.attempts DESC LIMIT $3
      `, userId, days, limit),
      query<CatalogHealthRow>(`
        WITH attempts AS (
          SELECT lesson_id, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners, AVG(score) AS avg_score,
            AVG(score) FILTER (WHERE attempt_number = 1) AS first_try_avg_score,
            AVG(CASE WHEN hints_used > 0 THEN 1.0 ELSE 0.0 END) AS hint_rate,
            AVG(CASE WHEN attempt_number > 1 THEN 1.0 ELSE 0.0 END) AS retry_rate,
            AVG(time_spent_seconds) AS avg_seconds_per_attempt
          FROM fact_segment_attempts WHERE user_id = $1 AND created_at >= CURRENT_TIMESTAMP - ($2 * INTERVAL 1 DAY) GROUP BY lesson_id
        )
        SELECT dl.course_id, dl.course_slug, dl.course_title_en, dl.course_title_es, dl.course_title_pt,
          dl.lesson_id, dl.slug AS lesson_slug, dl.title_en AS lesson_title_en, dl.title_es AS lesson_title_es, dl.title_pt AS lesson_title_pt,
          1 AS lessons, dl.segment_count AS segments, a.learners, a.attempts, a.avg_score, a.first_try_avg_score,
          a.hint_rate, a.retry_rate, a.avg_seconds_per_attempt, 0 AS starts, 0 AS completions, 0 AS abandons, NULL AS abandon_rate
        FROM attempts a JOIN dim_lessons dl USING (lesson_id)
        ORDER BY a.attempts DESC LIMIT $3
      `, userId, days, limit),
      getLearnerSkillStates(userId),
    ]);
    if (profiles === null || states === null) return null;
    return {
      profile: profiles.find((profile) => profile.userId === userId) ?? null,
      trends: trends.map((entry) => ({
        date: new Date(entry.date).toISOString().slice(0, 10), attempts: Number(entry.attempts), learners: Number(entry.learners),
        avgScore: numberOrNull(entry.avg_score), firstTryAvgScore: numberOrNull(entry.first_try_avg_score),
      })),
      courses: courseRows.map(toCourseHealth),
      lessons: lessonRows.map(toLessonHealth),
      states,
    };
  } catch (err) {
    console.error('[dataintel][learning] getLearnerLearningDetail failed:', err);
    return null;
  }
}
