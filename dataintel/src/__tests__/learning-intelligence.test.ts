import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { execute, initDb } from '../db/duckdb.js';
import { getDataQualityReport } from '../services/dataQuality.js';
import {
  getLearnerRecommendation,
  getLearnerLearningDetail,
  getLearningOverview,
  getLearnerSkillStates,
  getSkillHealth,
  refreshLearnerSkillStates,
} from '../services/learning.js';

describe('learning intelligence', () => {
  const learnerId = randomUUID();
  const courseId = randomUUID();
  const topicId = randomUUID();
  const lessonId = randomUUID();
  const skillKey = 'money/saving-basics';

  beforeAll(async () => {
    await initDb();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await execute(
        `INSERT INTO fact_segment_attempts_raw (
          attempt_id, user_id, lesson_id, course_id, topic_id, skill_key,
          segment_id, attempt_number, score, hints_used, time_spent_seconds,
          document_updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'save-quiz', ?, 20, 1, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        randomUUID(), learnerId, lessonId, courseId, topicId, skillKey, attempt,
      );
    }
    await refreshLearnerSkillStates();
  });

  it('derives an explainable remedial state from authoritative grading facts', async () => {
    const states = await getLearnerSkillStates(learnerId);
    expect(states).not.toBeNull();
    expect(states).toContainEqual(expect.objectContaining({
      skillKey,
      courseId,
      topicId,
      evidenceCount: 3,
      recommendedAction: 'remediate',
      reasonCode: 'low_mastery',
    }));
    const recommendation = await getLearnerRecommendation(learnerId);
    expect(recommendation).toMatchObject({ skillKey, recommendedAction: 'remediate' });
  });

  it('keeps content health aggregated and marks small samples as insufficient evidence', async () => {
    const health = await getSkillHealth(50);
    const skill = health?.find((row) => row.skillKey === skillKey);
    expect(skill).toMatchObject({
      learners: 1,
      attempts: 3,
      avgSecondsPerAttempt: 30,
      hintRate: 1,
      priority: 'insufficient_evidence',
    });
  });

  it('reports coverage and freshness separately so emptiness is never mistaken for health', async () => {
    await execute(
      `INSERT OR REPLACE INTO dataintel_sync_state
       (table_name, last_event_id, last_synced_at, rows_synced, last_error)
       VALUES ('attempts', 3, CURRENT_TIMESTAMP, 3, NULL)`,
    );
    const report = await getDataQualityReport();
    expect(report).not.toBeNull();
    expect(report!.attempts).toMatchObject({
      skillCoveragePct: expect.any(Number),
      timingCoveragePct: expect.any(Number),
      documentVersionCoveragePct: expect.any(Number),
    });
    expect(report!.freshness).toContainEqual(expect.objectContaining({ source: 'attempts', stale: false }));
  });

  it('keeps course, lesson, and learner feedback contextual and evidence-labelled', async () => {
    await execute(
      `INSERT INTO dim_lessons (
        lesson_id, slug, title_en, title_es, title_pt, course_id, course_slug,
        course_title_en, course_title_es, course_title_pt, segment_count
      ) VALUES (?, 'saving-basics', 'Saving basics', 'Fundamentos de ahorro', 'Fundamentos de poupança', ?, 'money',
        'Money habits', 'Hábitos de dinero', 'Hábitos financeiros', 3)`,
      lessonId,
      courseId,
    );

    const overview = await getLearningOverview(30, 100);
    expect(overview).not.toBeNull();
    expect(overview!.snapshot).toMatchObject({ courses: expect.any(Number), lessons: expect.any(Number), attempts: expect.any(Number) });
    expect(overview!.courses).toContainEqual(expect.objectContaining({
      courseId,
      courseSlug: 'money',
      courseTitleEn: 'Money habits',
      evidenceStatus: 'limited',
    }));
    expect(overview!.lessons).toContainEqual(expect.objectContaining({
      lessonId,
      lessonTitleEn: 'Saving basics',
      evidenceStatus: 'limited',
    }));
    expect(overview!.learners).toContainEqual(expect.objectContaining({ userId: learnerId, attempts: 3 }));

    const detail = await getLearnerLearningDetail(learnerId, 30, 100);
    expect(detail).not.toBeNull();
    expect(detail!.profile).toMatchObject({ userId: learnerId, recommendedAction: 'remediate' });
    expect(detail!.courses).toContainEqual(expect.objectContaining({ courseId, attempts: 3 }));
    expect(detail!.lessons).toContainEqual(expect.objectContaining({ lessonId, attempts: 3 }));
  });
});
