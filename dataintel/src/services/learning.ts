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
